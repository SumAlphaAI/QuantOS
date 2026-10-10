"""Build local wheels, install offline into a fresh venv, and exercise a real child UDS service."""

from pathlib import Path
import hashlib
import importlib.metadata
import shutil
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "artifacts/tp04-packaged"
wheels = out / "wheels"
wheels.mkdir(parents=True, exist_ok=True)
clean_env = {
    k: v
    for k, v in os.environ.items()
    if not any(
        s in k
        for s in [
            "DATABASE",
            "SUPABASE",
            "TOKEN",
            "SECRET",
            "PASSWORD",
            "QUANTOS_ENGINE",
            "QUANTOS_TRACE",
            "PYTHONPATH",
        ]
    )
}


def run(args):
    print("COMMAND " + json.dumps([str(a) for a in args]), flush=True)
    subprocess.run(
        [str(a) for a in args], cwd=ROOT, env=clean_env, check=True, timeout=180
    )


run(
    ["uv", "sync", "--locked", "--project", "engines", "--all-packages", "--all-groups"]
)

for project in ["engines/engine-sdk", "engines/trading-agents"]:
    run(
        [
            "uv",
            "build",
            "--project",
            project,
            "--python",
            ROOT / "engines/.venv/bin/python",
            "--wheel",
            "--no-build-isolation",
            "--out-dir",
            wheels,
        ]
    )

with tempfile.TemporaryDirectory(
    prefix="tp04-", dir="/private/tmp" if sys.platform == "darwin" else "/tmp"
) as td:
    temp = Path(td)
    interpreter = temp / "venv/bin/python"
    run(["uv", "venv", "--python", ROOT / "engines/.venv/bin/python", temp / "venv"])
    package_paths = sorted(wheels.glob("*.whl"))
    assert len(package_paths) == 2
    # Copy only the two already lock-installed runtime distributions, never editable project paths.
    purelib = Path(
        subprocess.check_output(
            [
                str(interpreter),
                "-I",
                "-c",
                'import sysconfig;print(sysconfig.get_path("purelib"))',
            ],
            text=True,
        ).strip()
    )
    for package, version in [("grpcio", "1.74.0"), ("protobuf", "5.29.6")]:
        dist = importlib.metadata.distribution(package)
        assert dist.version == version
        for entry in dist.files or []:
            if ".." in Path(entry).parts or str(entry).endswith(".pyc"):
                continue
            source = Path(dist.locate_file(entry))
            if source.is_file():
                destination = purelib / entry
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
    run(
        [
            "uv",
            "pip",
            "install",
            "--offline",
            "--no-deps",
            "--python",
            interpreter,
            *package_paths,
        ]
    )
    run(
        [
            interpreter,
            "-I",
            "-c",
            'import trading_agents,quantos_engine_sdk; assert "/site-packages/" in trading_agents.__file__; assert "/site-packages/" in quantos_engine_sdk.__file__; print("TP04_INSTALLED_WHEEL",trading_agents.__file__,quantos_engine_sdk.__file__)',
        ]
    )
    socket = temp / "engine.sock"
    with (out / "server.log").open("w") as log:
        child = subprocess.Popen(
            [
                str(interpreter),
                "-I",
                "-m",
                "trading_agents.server",
                "--socket",
                str(socket),
            ],
            cwd=temp,
            env=clean_env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(200):
                assert child.poll() is None, "packaged child exited during startup"
                if socket.exists():
                    break
                time.sleep(0.01)
            assert socket.exists()
            probe = r"""
import sys,grpc,json,time
from datetime import datetime,timedelta,timezone
from trading_agents.fixtures import load_fixture,build_signal_payload
from quantos.common.v1 import common_pb2 as c
from quantos.engine.v1 import engine_pb2 as e
from quantos_engine_sdk import EngineClient,json_document_from_mapping as doc,json_document_to_mapping as mapping,timestamp_from_datetime as ts,uds_target
client=EngineClient(uds_target(sys.argv[1]))
meta=c.CommandMetadata(request_id='packaged-request',tenant_id='tenant-packaged',workspace_id='workspace-packaged',actor=c.ActorRef(actor_id='actor-packaged',actor_kind=c.ACTOR_KIND_USER,capabilities=['decision.proposal.v1']),correlation_id='packaged-corr',causation_id='packaged-cause',mode=c.RUNTIME_MODE_RESEARCH,environment=c.ENVIRONMENT_TEST,issued_at=ts(datetime.now(timezone.utc)))
assert client.get_metadata(e.GetMetadataRequest(metadata=meta),timeout=3).engine_name=='trading-agents'
assert client.health(e.HealthRequest(metadata=meta),timeout=3).ready
fixture=load_fixture('committee_bull_breakout')
payload={'fixture':fixture.fixture_name,'account_id':'paper-account','policy_snapshot_id':'packaged-policy','portfolio_snapshot_id':'portfolio-packaged','signal':build_signal_payload(fixture,request_seed='packaged',tenant_id='tenant-packaged',workspace_id='workspace-packaged')}
request=e.ExecuteRequest(metadata=meta,workflow_run_id='packaged-run',idempotency_key='packaged-key',capability='decision.proposal.v1',input_schema_version='v1',data_snapshot_ref='portfolio-packaged',policy_context_ref='packaged-policy',input=doc(payload),deadline=ts(datetime.now(timezone.utc)+timedelta(seconds=10)))
a=client.execute(request,timeout=3);b=client.execute(request,timeout=3)
assert a.output==b.output and a.input_hash==b.input_hash and a.artifact_refs==b.artifact_refs
assert len(a.artifact_refs)==2 and all(r.uri.startswith('mock-artifact://') for r in a.artifact_refs)
assert mapping(a.output)['executable'] is False and len(mapping(a.output)['counter_views'])>0
stream=client.stream_execute(e.StreamExecuteRequest(request=request),timeout=3)
assert len(stream)==3 and stream[-1].done and stream[-1].artifact_refs==a.artifact_refs
request.idempotency_key='stream-cancel';request.input.CopyFrom(doc({**payload,'stream_delay_ms':1200}))
stream=client._stream_execute(e.StreamExecuteRequest(request=request),timeout=3);first=next(stream);assert not first.done and not first.artifact_refs
started=time.monotonic();assert client.cancel(e.CancelRequest(metadata=meta,execution_id=first.execution_id),timeout=3).cancelled
try:next(stream)
except grpc.RpcError as error:assert error.code()==grpc.StatusCode.CANCELLED
else:raise AssertionError('packaged stream cancellation not observed')
elapsed=(time.monotonic()-started)*1000;assert elapsed<2000
request.idempotency_key='denied';request.input.CopyFrom(doc({**payload,'tools':['read_secret']}))
for rpc in ['execute','stream']:
 try:
  if rpc=='execute':client.execute(request,timeout=3)
  else:client.stream_execute(e.StreamExecuteRequest(request=request),timeout=3)
 except grpc.RpcError as error:assert error.code()==grpc.StatusCode.PERMISSION_DENIED
 else:raise AssertionError('packaged forbidden tool accepted')
client.close()
print(json.dumps({'cancelMillis':elapsed,'cancelStatus':'CANCELLED','finalArtifactSeen':False},sort_keys=True))
"""
            cancel_result = json.loads(
                subprocess.check_output(
                    [str(interpreter), "-I", "-c", probe, str(socket)],
                    cwd=temp,
                    env=clean_env,
                    text=True,
                    timeout=30,
                )
            )
            print(
                "TP04_PACKAGED_FIVE_RPC_PASS actual installed child stream cancelled <2s"
            )
        finally:
            child.terminate()
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)
            assert child.poll() is not None

receipt = {
    "schema": "quantos-tp04-packaged-service/v1",
    "status": "PASS",
    "formalAccepted": False,
    "wheels": [
        {"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in package_paths
    ],
    "installedIsolated": True,
    "ownedChildReaped": True,
    "rpcCount": 5,
    "capabilities": 1,
    "cancellation": cancel_result,
    "realUpstreamRuntime": False,
}
(out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, sort_keys=True))
print("TP04_PACKAGED_SERVICE_PASS")
