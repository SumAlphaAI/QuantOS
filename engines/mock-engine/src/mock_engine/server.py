"""CLI entrypoint for the QuantOS mock engine UDS server."""

from __future__ import annotations

import argparse
from pathlib import Path

from mock_engine.service import MockEngineService
from quantos_engine_sdk import serve_engine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QuantOS mock engine")
    parser.add_argument("--socket", required=True, help="Absolute Unix socket path")
    parser.add_argument(
        "--failures-before-success",
        type=int,
        default=0,
        help="Return UNAVAILABLE for the first N Execute calls",
    )
    parser.add_argument(
        "--exit-on-execute",
        action="store_true",
        help="Terminate the process immediately when Execute is received",
    )
    parser.add_argument(
        "--crash-state-file",
        type=Path,
        help="Test fixture counter persisted across supervised process restarts",
    )
    parser.add_argument(
        "--default-sleep-ms",
        type=int,
        default=0,
        help="Sleep for N ms before Execute and StreamExecute when the request omits sleep_ms",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    socket_path = Path(args.socket).resolve()
    socket_path.parent.mkdir(parents=True, exist_ok=True)
    if socket_path.exists():
        socket_path.unlink()

    server = serve_engine(
        socket_path,
        MockEngineService(
            failures_before_success=args.failures_before_success,
            default_sleep_ms=args.default_sleep_ms,
            exit_on_execute=args.exit_on_execute,
            crash_state_file=args.crash_state_file,
        ),
    )
    try:
        server.wait_for_termination()
    finally:
        server.stop(grace=0)


if __name__ == "__main__":
    main()
