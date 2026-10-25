#!/usr/bin/python3
import os
import sys
import json
import time

assert not any(
    k in os.environ
    for k in ("DATABASE_URL", "SUPABASE_URL", "TOKEN", "SECRET", "SIGNING_KEY")
)
mode = os.path.basename(sys.argv[0]).removesuffix(".py")
if mode == "handshake":
    print(
        json.dumps({"schema": "wrong", "backend": "QUANTOS_PAPER", "pid": os.getpid()}),
        flush=True,
    )
    sys.exit(0)
print(
    json.dumps(
        {"schema": "quantos-kernel/v1", "backend": "QUANTOS_PAPER", "pid": os.getpid()}
    ),
    flush=True,
)
for line in sys.stdin:
    request = json.loads(line)
    assert set(request) == {"schema", "request_id", "order", "submitted_at"}
    forbidden = (
        "tenant_id",
        "actor_id",
        "requester",
        "session",
        "token",
        "approval",
        "signature",
        "decision",
    )
    assert not any(key in request["order"] for key in forbidden)
    if mode == "timeout":
        time.sleep(3)
    if mode == "crash":
        sys.exit(1)
    if mode == "oversize":
        print("x" * 70000, flush=True)
        continue
    reply = {
        "schema": "quantos-kernel/v1",
        "request_id": request["request_id"],
        "events": [],
    }
    if mode == "wrong_id":
        reply["request_id"] = "foreign"
    if mode == "unknown_field":
        reply["secret"] = "unexpected"
    if mode == "unknown_event":
        reply["events"] = [
            {
                "kind": "order_accepted",
                "command_id": "foreign",
                "venue_order_id": "v",
                "at": request["submitted_at"],
            }
        ]
    if mode == "no_newline":
        sys.stdout.write(json.dumps(reply))
        sys.stdout.flush()
        sys.exit(0)
    print(json.dumps(reply), flush=True)
