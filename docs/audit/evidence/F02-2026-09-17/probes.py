"""F02 source/mock negative probes. Run from the repository root; no live DB."""

from pathlib import Path
import tempfile
import shutil
import subprocess
import os
import json

root = Path.cwd()
results = []


def run(name, cmd, cwd, env=None):
    p = subprocess.run(
        cmd, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True
    )
    results.append(
        {
            "probe": name,
            "exitCode": p.returncode,
            "stdout": p.stdout[-5000:],
            "stderr": p.stderr[-1500:],
        }
    )
    return p


with tempfile.TemporaryDirectory(prefix="f02-probes-") as td:
    t = Path(td)
    m = t / "supabase/migrations"
    m.mkdir(parents=True)
    fixture = """create table quantos.sample (id uuid default gen_random_uuid(), owner uuid references auth.users, created_at timestamptz);
alter table quantos.sample enable row level security;
alter table quantos.sample force row level security;
create policy sample_read on quantos.sample for select using (true);
"""
    f = m / "20260101000000_fixture.sql"
    f.write_text(fixture)
    cmd = ["bash", str(root / "scripts/check-rls-baseline.sh")]
    env = {"QUANTOS_GATE_ROOT": str(t)}
    assert run("RLS positive baseline", cmd, t, env).returncode == 0
    f.write_text(
        fixture.replace(
            "create policy sample_read on quantos.sample for select using (true);",
            "create index sample_idx on quantos.sample (owner);",
        )
    )
    run("no policy but index on table", cmd, t, env)
    f.write_text(fixture + "alter table quantos.sample disable row level security;\n")
    run("RLS disabled by later statement", cmd, t, env)
    scripts = t / "scripts"
    scripts.mkdir()
    for name in ["db-cli.cjs", "sign-artifacts.sh", "verify-artifact-signatures.sh"]:
        shutil.copy(root / "scripts" / name, scripts / name)
    (
        t / "fake-pg.cjs"
    ).write_text("""const Module=require('module'); const original=Module._load;
Module._load=function(id,...rest){if(id==='pg')return {Client:class {async connect(){} async end(){} async query(sql){console.log('QUERY:',sql.trim());if(sql.includes('to_regclass'))return {rows:[{regclass:'quantos.schema_migrations'}]}; if(sql.includes('select filename'))return {rows:[{filename:'20260101000000_fixture.sql'}]};throw Error('Unexpected query');}}};return original.call(this,id,...rest)};
""")
    run(
        "schema diff: same ledger with altered SQL and disabled RLS (mock PG)",
        [
            "node",
            "--require",
            str(t / "fake-pg.cjs"),
            str(scripts / "db-cli.cjs"),
            "schema-diff",
        ],
        t,
        {"DATABASE_URL": "postgresql://fixture:fixture@localhost/fixture"},
    )
    artifacts = t / "artifacts"
    artifacts.mkdir()
    manifest = artifacts / "manifest.json"
    sbom = artifacts / "sbom.json"
    payload = artifacts / "runtime.bin"
    manifest.write_text('{"commit":"fixture"}')
    sbom.write_text('{"packages":[]}')
    payload.write_text("original runtime")
    args = [str(manifest), str(sbom)]
    env = {
        "QUANTOS_REQUIRE_FORMAL_SIGNATURE": "1",
        "QUANTOS_SIGNING_KEY": "f02-local-fixture-not-a-real-key",
    }
    assert (
        run(
            "sign metadata positive",
            ["bash", str(scripts / "sign-artifacts.sh"), *args],
            t,
            env,
        ).returncode
        == 0
    )
    assert (
        run(
            "verify metadata positive",
            ["bash", str(scripts / "verify-artifact-signatures.sh"), *args],
            t,
            env,
        ).returncode
        == 0
    )
    payload.write_text("modified runtime")
    run(
        "runtime changed, metadata verification",
        ["bash", str(scripts / "verify-artifact-signatures.sh"), *args],
        t,
        env,
    )
    manifest.write_text('{"commit":"tampered"}')
    assert (
        run(
            "signed metadata tamper rejected",
            ["bash", str(scripts / "verify-artifact-signatures.sh"), *args],
            t,
            env,
        ).returncode
        != 0
    )
print(json.dumps({"kind": "SOURCE_MOCK_NEGATIVE_PROBES", "results": results}, indent=2))
