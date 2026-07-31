"""License gate for TP05 OpenBB adapter enablement."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import grpc


@dataclass(frozen=True)
class LicenseGateDecision:
    provider: str
    upstream_repo: str
    upstream_ref: str
    license_label: str
    status: str
    commercial_license: bool
    allow_evaluation: bool
    allow_production: bool
    decision_ref: str
    notice_required: bool
    approved_datasets: tuple[str, ...]
    blocked_reason: str

    @property
    def approved_for_production(self) -> bool:
        return self.allow_production and self.status == "approved"

    @classmethod
    def load_default(cls) -> "LicenseGateDecision":
        policy_path = Path(__file__).with_name("policy") / "license_gate.json"
        parsed = json.loads(policy_path.read_text(encoding="utf-8"))
        return cls(
            provider=parsed["provider"],
            upstream_repo=parsed["upstream_repo"],
            upstream_ref=parsed["upstream_ref"],
            license_label=parsed["license_label"],
            status=parsed["status"],
            commercial_license=bool(parsed["commercial_license"]),
            allow_evaluation=bool(parsed["allow_evaluation"]),
            allow_production=bool(parsed["allow_production"]),
            decision_ref=parsed["decision_ref"],
            notice_required=bool(parsed["notice_required"]),
            approved_datasets=tuple(parsed["approved_datasets"]),
            blocked_reason=parsed["blocked_reason"],
        )

    def ensure_runtime_allowed(
        self,
        *,
        provider_name: str,
        deployment_target: str,
        dataset: str,
    ) -> None:
        if provider_name != self.provider:
            return
        if dataset not in self.approved_datasets:
            raise LicenseGateError(
                grpc.StatusCode.PERMISSION_DENIED,
                f"dataset `{dataset}` is not approved for isolated OpenBB evaluation",
            )

        target = deployment_target.strip().lower()
        if target == "production":
            raise LicenseGateError(
                grpc.StatusCode.FAILED_PRECONDITION,
                self.blocked_reason,
            )
        if not self.allow_evaluation:
            raise LicenseGateError(
                grpc.StatusCode.FAILED_PRECONDITION,
                self.blocked_reason,
            )


class LicenseGateError(Exception):
    """Raised when the TP05 license gate blocks enablement."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check TP05 OpenBB license gate")
    parser.add_argument("--provider", default="openbb", help="Provider name to evaluate")
    parser.add_argument(
        "--environment",
        default="production",
        choices=("evaluation", "test", "production"),
        help="Target environment for the build or deployment",
    )
    parser.add_argument(
        "--dataset",
        default="crypto.market.snapshot",
        help="Dataset identifier to validate",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    decision = LicenseGateDecision.load_default()
    try:
        decision.ensure_runtime_allowed(
            provider_name=args.provider,
            deployment_target=args.environment,
            dataset=args.dataset,
        )
    except LicenseGateError as error:
        print(str(error))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
