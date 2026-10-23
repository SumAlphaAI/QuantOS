"""Twenty owned Strategy Lab IPC artifacts for the G3 browser composition. No live model or credentials."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from quantos_engine_sdk import EngineClient, json_document_to_mapping, uds_target

# Existing contract builders supply owned synthetic identity/references, never credentials.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engines/tests"))
from test_strategy_lab_contract import build_input, build_request  # noqa: E402

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="quantos-g3-", dir="/tmp") as directory:
    socket = Path(directory) / "engine.sock"
    process = subprocess.Popen(
        [sys.executable, "-m", "strategy_lab.server", "--socket", str(socket)],
        cwd=root / "engines",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    client = EngineClient(uds_target(socket))
    try:
        for _ in range(100):
            if socket.exists():
                break
            if process.poll() is not None:
                raise RuntimeError("owned Engine exited before readiness")
            time.sleep(0.05)
        documents = []
        for index in range(20):
            fixture = "trend_momentum_btc"
            response = client.execute(
                build_request(index, build_input(fixture)), timeout=5
            )
            assert len(response.artifact_refs) == 2
            documents.append(json_document_to_mapping(response.output))
        print(json.dumps(documents))
    finally:
        client.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if process.stderr:
            process.stderr.close()
