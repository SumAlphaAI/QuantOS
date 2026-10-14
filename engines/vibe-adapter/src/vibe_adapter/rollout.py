"""Host-owned, process-local canary control. No deployment or release approval."""

from __future__ import annotations

import hashlib
import hmac
import json
import math
from dataclasses import dataclass
from threading import RLock
from typing import Callable, TypeVar

from vibe_adapter.fixtures import contracts_from_bytes
from vibe_adapter.providers import InMemoryResearchContractProvider

T = TypeVar("T")


class RolloutError(ValueError):
    """Safe machine code for an invalid artifact or unavailable route."""


def canonical(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def release_descriptor(release_id: str, artifact: bytes, policy: dict) -> dict:
    """Descriptor to be signed by a separately configured host authority."""
    return {
        "schema": "quantos-vibe-local-release/v1",
        "releaseId": release_id,
        "artifactSha256": hashlib.sha256(artifact).hexdigest(),
        "policySha256": hashlib.sha256(canonical(policy)).hexdigest(),
        "scope": "LOCAL_RESEARCH_ONLY",
    }


@dataclass(frozen=True)
class VerifiedRelease:
    release_id: str
    artifact_sha256: str
    provider: InMemoryResearchContractProvider


@dataclass
class RolloutLease:
    epoch: int
    release: VerifiedRelease
    identity: str
    shadow: bool
    committed: bool = False


class RolloutController:
    """Disable and Artifact commit share a lock; old work cannot commit later.

    All state is local to this process. The caller owns trusted policy and key;
    request payloads never select a release, authority, or rollout action.
    """

    def __init__(self, policy: dict, authority_key: bytes) -> None:
        if len(authority_key) < 32:
            raise RolloutError("ENGINE_ROLLOUT_AUTHORITY_INVALID")
        self._policy = json.loads(canonical(policy))
        limits = self._policy.get("rolloutPolicy", {})
        numeric = (
            "canaryTrafficPercent",
            "maxUnexplainedP1",
            "maxExecuteP95Ms",
            "maxCancelConfirmSecs",
            "maxErrorRate",
            "maxShadowMismatchRate",
            "maxUnauthorizedEgress",
            "maxSecretOrVenueViolations",
        )
        if (
            any(
                isinstance(limits.get(k), bool)
                or not isinstance(limits.get(k), (int, float))
                or not math.isfinite(limits[k])
                or limits[k] < 0
                for k in numeric
            )
            or not 0 < limits["canaryTrafficPercent"] <= 100
        ):
            raise RolloutError("ENGINE_ROLLOUT_POLICY_INVALID")
        self._key = bytes(authority_key)
        self._lock = RLock()
        self._epoch = 0
        self._state = "disabled"
        self._active: VerifiedRelease | None = None
        self._previous: VerifiedRelease | None = None
        self._events: list[dict] = []
        self._shadow_completed = 0
        self._shadow_mismatches = 0
        self._event("initialized")

    def _event(self, action: str, **fields) -> None:
        self._events.append(
            {
                "sequence": len(self._events) + 1,
                "action": action,
                "epoch": self._epoch,
                "state": self._state,
                **fields,
            }
        )

    def _verify(self, artifact: bytes, descriptor: dict, signature: str) -> VerifiedRelease:
        try:
            expected = release_descriptor(descriptor["releaseId"], artifact, self._policy)
            valid_id = (
                isinstance(descriptor["releaseId"], str) and 0 < len(descriptor["releaseId"]) <= 128
            )
            expected_signature = hmac.new(
                self._key, canonical(expected), hashlib.sha256
            ).hexdigest()
            if (
                not valid_id
                or descriptor != expected
                or not hmac.compare_digest(signature, expected_signature)
            ):
                raise ValueError("signature")
            contracts = contracts_from_bytes(artifact)
            return VerifiedRelease(
                descriptor["releaseId"],
                expected["artifactSha256"],
                InMemoryResearchContractProvider(contracts),
            )
        except Exception as error:
            raise RolloutError("ENGINE_ROLLOUT_SIGNATURE_INVALID") from error

    def activate_canary(
        self, *, candidate: tuple[bytes, dict, str], previous: tuple[bytes, dict, str]
    ) -> None:
        # Verify both complete artifacts before any routing state changes.
        with self._lock:
            try:
                selected, fallback = self._verify(*candidate), self._verify(*previous)
                if selected.release_id == fallback.release_id:
                    raise RolloutError("ENGINE_ROLLOUT_RELEASE_CONFLICT")
            except RolloutError:
                self._event("activation_rejected")
                raise
            self._epoch += 1
            self._active, self._previous = selected, fallback
            self._state = "canary"
            self._event(
                "canary_activated",
                releaseId=selected.release_id,
                artifactSha256=selected.artifact_sha256,
            )

    def disable(self, reason: str) -> None:
        self._action("disable", reason)

    def rollback(self, reason: str) -> None:
        self._action("rollback", reason)

    def _action(self, action: str, reason: str) -> None:
        if not isinstance(reason, str) or not reason.strip() or len(reason) > 1024:
            raise RolloutError("ENGINE_ROLLOUT_REASON_INVALID")
        with self._lock:
            if action == "rollback" and self._previous is None:
                raise RolloutError("ENGINE_ROLLOUT_PREVIOUS_MISSING")
            self._epoch += 1
            self._state = "disabled" if action == "disable" else "rolled_back"
            if action == "rollback":
                self._active = self._previous
            # Retain a reason digest instead of arbitrary caller text/secrets.
            self._event(action, reasonSha256=hashlib.sha256(reason.encode()).hexdigest())

    def admit(self, identity: str, *, shadow: bool = False) -> RolloutLease:
        with self._lock:
            if self._state == "disabled" or self._active is None:
                self._event("dispatch_rejected")
                raise RolloutError("ENGINE_ROLLOUT_DISABLED")
            identity_hash = hashlib.sha256(identity.encode()).hexdigest()
            bucket = int(identity_hash[:8], 16) % 10000
            percent = self._policy["rolloutPolicy"]["canaryTrafficPercent"]
            if self._state == "canary" and not shadow and bucket >= percent * 100:
                self._event("dispatch_excluded")
                raise RolloutError("ENGINE_ROLLOUT_NOT_SELECTED")
            self._event("dispatch_admitted", requestSha256=identity_hash, shadow=shadow)
            return RolloutLease(self._epoch, self._active, identity_hash, shadow)

    def check(self, lease: RolloutLease) -> None:
        with self._lock:
            if not lease.committed and (lease.epoch != self._epoch or self._state == "disabled"):
                raise RolloutError("ENGINE_ROLLOUT_REVOKED")

    def commit(self, lease: RolloutLease, write: Callable[[], T]) -> T:
        with self._lock:
            self.check(lease)
            result = write()
            lease.committed = True
            if lease.shadow:
                self._shadow_completed += 1
            self._event(
                "artifact_committed",
                requestSha256=lease.identity,
                releaseId=lease.release.release_id,
                shadow=lease.shadow,
            )
            return result

    def observe_shadow(self, primary: dict, shadow: dict) -> None:
        with self._lock:
            if canonical(primary) != canonical(shadow):
                self._shadow_mismatches += 1
            self._event("shadow_compared", mismatch=canonical(primary) != canonical(shadow))

    def observe(self, metrics: dict) -> list[dict]:
        limits = self._policy["rolloutPolicy"]
        mapping = {
            "unexplainedP1": ("maxUnexplainedP1", "critical"),
            "executeP95Ms": ("maxExecuteP95Ms", "critical"),
            "cancelConfirmSecs": ("maxCancelConfirmSecs", "critical"),
            "errorRate": ("maxErrorRate", "critical"),
            "shadowMismatchRate": ("maxShadowMismatchRate", "warning"),
            "unauthorizedEgress": ("maxUnauthorizedEgress", "critical"),
            "secretOrVenueViolations": ("maxSecretOrVenueViolations", "critical"),
        }
        if set(metrics) != set(mapping) or any(
            isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0
            for v in metrics.values()
        ):
            raise RolloutError("ENGINE_ROLLOUT_METRICS_INVALID")
        with self._lock:
            alerts = [
                {
                    "metric": metric,
                    "severity": severity,
                    "value": metrics[metric],
                    "threshold": limits[key],
                }
                for metric, (key, severity) in mapping.items()
                if metrics[metric] > limits[key]
            ]
            self._event("metrics_observed", alerts=alerts)
            if any(alert["severity"] == "critical" for alert in alerts):
                self.disable("critical canary threshold")
            return alerts

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "schema": "quantos-vibe-local-rollout/v1",
                "state": self._state,
                "epoch": self._epoch,
                "activeRelease": self._active.release_id if self._active else None,
                "activeArtifactSha256": self._active.artifact_sha256 if self._active else None,
                "candidateTrafficPercent": self._policy["rolloutPolicy"]["canaryTrafficPercent"]
                if self._state == "canary"
                else 0,
                "shadowCompleted": self._shadow_completed,
                "shadowMismatches": self._shadow_mismatches,
                "events": json.loads(json.dumps(self._events)),
                "formalAccepted": False,
                "targetCanaryAccepted": False,
                "databaseExecution": False,
            }
