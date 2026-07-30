"""Research-safe tool allowlist for the TP01 vibe adapter."""

from __future__ import annotations

from dataclasses import dataclass


class ToolPolicyError(ValueError):
    """Raised when a requested tool violates the adapter policy."""


SAFE_TOOL_ALLOWLIST = (
    "read_document",
    "read_url",
    "web_search",
    "load_skill",
    "list_skills",
)

FORBIDDEN_TOOL_PREFIXES = (
    "trading_",
    "bash",
    "background_",
)

FORBIDDEN_TOOL_NAMES = {
    "edit_file",
    "write_file",
    "skill_writer",
    "remember",
    "session_search",
}


@dataclass(frozen=True)
class ToolAllowlistPolicy:
    """Policy object used by the context translator."""

    allowed_tools: tuple[str, ...] = SAFE_TOOL_ALLOWLIST

    def normalize(self, requested_tools: list[str] | tuple[str, ...] | None) -> tuple[str, ...]:
        if not requested_tools:
            return self.allowed_tools

        normalized = []
        allowed = set(self.allowed_tools)
        for tool_name in requested_tools:
            name = str(tool_name).strip()
            if not name:
                continue
            if name in FORBIDDEN_TOOL_NAMES or any(
                name.startswith(prefix) for prefix in FORBIDDEN_TOOL_PREFIXES
            ):
                raise ToolPolicyError(f"tool `{name}` is forbidden by TP01 policy")
            if name not in allowed:
                raise ToolPolicyError(f"tool `{name}` is not in the vibe-adapter allowlist")
            normalized.append(name)

        return tuple(dict.fromkeys(normalized))
