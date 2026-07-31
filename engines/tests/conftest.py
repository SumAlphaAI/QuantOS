from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

for relative in (
    "engines/engine-sdk/sdk_src",
    "engines/engine-sdk/src",
    "engines/llmquant/src",
    "engines/mock-engine/src",
    "engines/openbb-adapter/src",
    "engines/rd-agent/src",
    "engines/trading-agents/src",
    "engines/vibe-adapter/src",
):
    candidate = str(ROOT / relative)
    if candidate not in sys.path:
        sys.path.insert(0, candidate)
