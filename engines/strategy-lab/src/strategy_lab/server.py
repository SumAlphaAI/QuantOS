"""CLI entrypoint for the TP06 strategy-lab UDS server."""

from __future__ import annotations

import argparse
from pathlib import Path

from quantos_engine_sdk import serve_engine

from strategy_lab.service import StrategyLabService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QuantOS strategy-lab engine")
    parser.add_argument("--socket", required=True, help="Absolute Unix socket path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    socket_path = Path(args.socket).resolve()
    socket_path.parent.mkdir(parents=True, exist_ok=True)
    if socket_path.exists():
        socket_path.unlink()

    server = serve_engine(socket_path, StrategyLabService())
    try:
        server.wait_for_termination()
    finally:
        server.stop(grace=0)


if __name__ == "__main__":
    main()
