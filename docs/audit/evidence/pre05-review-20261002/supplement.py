from pathlib import Path
import os
import json
import subprocess
import hashlib
import time

folder = Path(__file__).resolve().parent
root = folder.parents[3]
receipt = json.loads((folder / "commands.json").read_text())
w = Path(receipt["workspace"])
env = {
    k: os.environ[k]
    for k in ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR"]
    if k in os.environ
}
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
env["NEXT_TELEMETRY_DISABLED"] = "1"
env["GITHUB_SHA"] = receipt["baseline"]
results = []


def run(name, args, settings=env):
    start = time.monotonic()
    with (folder / (name + ".log")).open("w") as out:
        code = subprocess.run(
            args, cwd=w, env=settings, stdout=out, stderr=subprocess.STDOUT, timeout=240
        ).returncode
    results.append(
        {
            "name": name,
            "command": args,
            "exit_code": code,
            "seconds": round(time.monotonic() - start, 3),
            "log": name + ".log",
        }
    )
    print(name, code, flush=True)
    return code


# Gate must bind names to profiles; mutation is restored and only affects temporary archive.
files = [w / "env/local-integrated.env.example", w / "env/staging.env.example"]
original = {p: p.read_bytes() for p in files}
try:
    for p in files:
        p.write_bytes((w / "env/local-mock.env.example").read_bytes())
    run("duplicate-profiles-cli", ["pnpm", "check:pre05"])
    run("duplicate-profiles-tests", ["pnpm", "test:pre05"])
finally:
    for p, b in original.items():
        p.write_bytes(b)
p = w / "env/staging.env.example"
old = p.read_text()
try:
    p.write_text(
        "\n".join(
            line
            for line in old.splitlines()
            if not line.startswith("QUANTOS_E2E_ACCOUNT_")
        )
        + "\n"
    )
    run("missing-test-identities-cli", ["pnpm", "check:pre05"])
    run("missing-test-identities-tests", ["pnpm", "test:pre05"])
finally:
    p.write_text(old)
run(
    "absolute-cli-path",
    [
        "node",
        "packages/config/scripts/check-env.mjs",
        str(w / "env/local-mock.env.example"),
    ],
)
# Synthetic secret, not a real credential; preserve only digest and file paths in evidence.
settings = env.copy()
for line in (w / "env/local-mock.env.example").read_text().splitlines():
    if line.startswith("NEXT_PUBLIC_"):
        key, value = line.split("=", 1)
        settings[key] = value
canary = "gh" + "p_" + "A" * 36
settings["NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID"] = canary
code = run(
    "synthetic-secret-terminal-build",
    ["pnpm", "--filter", "@sumalpha/terminal", "build"],
    settings,
)
hits = [
    str(p.relative_to(w))
    for p in (w / "apps/terminal/out").rglob("*.js")
    if canary.encode() in p.read_bytes()
]
assert code == 0 and hits
(folder / "bundle-canary.json").write_text(
    json.dumps(
        {
            "kind": "SYNTHETIC_ONLY_NOT_A_REAL_SECRET",
            "fingerprint": "GitHub personal token shape",
            "sha256": hashlib.sha256(canary.encode()).hexdigest(),
            "build_exit": code,
            "client_js_hits": hits,
            "actual_credential_detected": False,
            "interpretation": "known secret-shaped public input accepted and emitted; no production leak asserted",
        },
        indent=2,
    )
    + "\n"
)
# Real auth functions, mocked fetch only; no external DNS or service use.
test = w / "apps/terminal/tests/pre05-audit-probe.test.ts"
test.write_text("""import {it,expect} from "vitest";
import {buildAuthorizeUrl,exchangeCode} from "../src/auth/flow";
it("issuer path is lost by real authorization and token builders",async()=>{
 const config={issuer:"https://idp.example.test/tenant/realm",clientId:"probe",redirectUri:"http://localhost:3100/auth/callback"};
 const pending={verifier:"v",state:"s",returnTo:"/command"};
 expect(new URL(buildAuthorizeUrl(config,pending,"c")).pathname).toBe("/authorize");
 const calls:string[]=[]; const fetchImpl=(async(url:unknown)=>{calls.push(String(url));return new Response(JSON.stringify({subject:"probe"}),{status:200});}) as typeof fetch;
 await exchangeCode(config,pending,"code","s",fetchImpl);
 expect(calls).toEqual(["https://idp.example.test/token"]);
});
it("local mock authorization uses external issuer URL",()=>{
 const config={issuer:"https://mock.idp.local",clientId:"probe",redirectUri:"http://localhost:3100/auth/callback"};
 expect(new URL(buildAuthorizeUrl(config,{verifier:"v",state:"s",returnTo:"/command"},"c")).origin).toBe("https://mock.idp.local");
});
""")
try:
    run(
        "auth-runtime-probes",
        [
            "pnpm",
            "--filter",
            "@sumalpha/terminal",
            "exec",
            "vitest",
            "run",
            "tests/pre05-audit-probe.test.ts",
        ],
    )
finally:
    test.unlink()
# Next uses dotenv; compare supported inline comments against CLI's separate parser.
probe = w / "pre05-dotenv-probe.mjs"
probe.write_text("""import {createRequire} from 'node:module';import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {parseEnvText,validateEnv} from './packages/config/src/env.ts';
const require=createRequire(new URL('./apps/terminal/package.json',import.meta.url));const {loadEnvConfig}=createRequire(require.resolve('next/package.json'))('@next/env');const dir=mkdtempSync(join(tmpdir(),'pre05-dotenv-'));
try {const text=readFileSync('env/local-mock.env.example','utf8').replace('NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=true','NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=true # local mock');writeFileSync(join(dir,'.env.local'),text);const actual=loadEnvConfig(dir,false,console,true).parsedEnv;console.log(JSON.stringify({cli_ok:validateEnv(parseEnvText(text)).ok,next_ok:validateEnv(actual).ok,cli_mock_value:parseEnvText(text).NEXT_PUBLIC_QUANTOS_MOCK_ENABLED,next_mock_value:actual.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED}));} finally{rmSync(dir,{recursive:true,force:true});}""")
try:
    run("dotenv-parser-comparison", ["node", str(probe)])
finally:
    probe.unlink()
(folder / "supplement-commands.json").write_text(
    json.dumps(
        {
            "baseline": receipt["baseline"],
            "results": results,
            "mutation_scope": "temporary archive only, original source files restored; synthetic canary build; no target network",
        },
        indent=2,
    )
    + "\n"
)
print("supplement complete", flush=True)
