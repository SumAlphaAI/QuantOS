"""CLI entrypoint for the TP01 vibe-adapter UDS server."""

from __future__ import annotations

import argparse
from pathlib import Path

from quantos_engine_sdk import serve_engine
from vibe_adapter.service import VibeAdapterService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QuantOS vibe adapter")
    parser.add_argument("--socket", required=True, help="Absolute Unix socket path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    socket_path = Path(args.socket)
    if not socket_path.is_absolute():
        raise ValueError("ENGINE_SOCKET_MUST_BE_ABSOLUTE")
    socket_path.parent.mkdir(parents=True, exist_ok=True)
    if socket_path.exists() or socket_path.is_symlink():
        raise FileExistsError("ENGINE_SOCKET_ALREADY_EXISTS")

    server = serve_engine(socket_path, VibeAdapterService())
    socket_path.chmod(0o600)
    try:
        server.wait_for_termination()
    finally:
        server.stop(grace=0)


if __name__ == "__main__":
    main()
