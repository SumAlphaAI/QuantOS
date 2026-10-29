// Actual G8 C01/C10/C11/C16 reference BFF bytes through a loopback TLS/CORS and identity substitute.
import {ownedZone} from "./core-l4-zone";
import { test, expect, type Page } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { isIP } from "node:net";
import { createServer, request as secureRequest } from "node:https";
import { request, type ServerResponse } from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const origin = "https://127.0.0.1:4010", terminal = "http://localhost:3190", csrf = "csrf-token-0000000000000001";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
type Row = {
    query: Record<string, string>;
    method: string;
    path: string;
    status: number;
    source: string;
    control: boolean;
    keyHash?: string;
    bodyHash: string;
    version?: string;
    responseHash?: string;
    errorCode?: string;
};
type Session = 'session-current' | 'session-owner' | 'session-approver' | 'session-viewer';
let activeSession: Session = 'session-current';
export function useSession(session: Session) { activeSession = session; }
const receipts: Record<string, unknown>[] = [];
export const businessReceipts = () => receipts;
let rows: Row[] = [], child: ChildProcess, port: number, scratch: string;
let zone: Awaited<ReturnType<typeof ownedZone>> | undefined;
export const zoneSnapshot=()=>zone?.snapshot();
// Owner-side fault injection only; no product upload/mutation route is added.
export async function invalidateOwnedObserver(){
 if(!zone)throw Error('Owned mTLS zone required');
 const {readFile,writeFile}=await import('node:fs/promises'),path=zone.directory+'/observer.json';
 const original=await readFile(path),envelope=JSON.parse(original.toString());
 envelope.signature='00';await writeFile(path,JSON.stringify(envelope),{mode:0o600});
 return async()=>{await writeFile(path,original,{mode:0o600});};
}
let flags: {
    drop?: boolean;
    readonly?: boolean;
    expired?: boolean;
    empty?: boolean;
    foreign?: boolean;
    gap?: boolean;
    conflict?: boolean;
    rateLimit?: boolean;
    slow?: boolean;
    streamForbidden?: boolean;
    stateRows?: boolean;
    largeDecimal?: boolean;
    dropPath?: string;
    nonJsonPath?: string;
    refusal?: 401 | 403;
} = {};
const streams = new Set<ServerResponse>();
let probes: string[] = [];
export function probe(label: string) { probes.push(label); }
export const networkRows = () => rows;
export function fault(next: typeof flags) { flags = next; }
const proxy = createServer({}, async (req, res) => {
    const u = new URL(req.url!, origin), path = u.pathname, method = req.method!;
    for (const [k, v] of Object.entries({ 'access-control-allow-origin': terminal, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,x-csrf-token,x-request-id,idempotency-key,if-match', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'cache-control': 'no-store', 'access-control-expose-headers': 'x-stream-id' }))
        res.setHeader(k, v);
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    const chunks: Buffer[] = [];
    for await (const b of req)
        chunks.push(Buffer.from(b));
    const body = Buffer.concat(chunks);
    const row: Row = { query: Object.fromEntries([...u.searchParams].map(([k, v]) => [k, k === 'ticket' ? 'sha256:' + hash(v) : v])), method, path, status: 0, source: 'REFERENCE_BYTES', control: Boolean(req.headers['x-frontend-g8-control']), bodyHash: hash(body), version: req.headers['if-match'] as string | undefined, keyHash: req.headers['idempotency-key'] ? hash(String(req.headers['idempotency-key'])) : undefined };
    rows.push(row);
    if (!row.control && ['POST', 'PUT', 'DELETE'].includes(method) && path.startsWith('/v1/admin/') && (flags.rateLimit || flags.conflict)) {
        row.source = 'SYNTHETIC_HTTP_REFUSAL';
        row.status = flags.rateLimit ? 429 : 409;
        const bytes = Buffer.from(JSON.stringify({ code: flags.rateLimit ? 'RATE_LIMITED' : 'VERSION_CONFLICT', message: 'private SQL secret', correlationId: 'aaaaaaaa-1111-4111-8111-111111111111', ...flags.rateLimit ? { retryAfter: 1 } : {} }));
        row.responseHash = hash(bytes);
        res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length });
        res.end(bytes);
        return;
    }
    if (!row.control && flags.nonJsonPath && path === flags.nonJsonPath) {
        row.source = 'SYNTHETIC_NON_JSON_AUTHORITY_REFUSAL';
        row.status = flags.refusal ?? 403;
        res.writeHead(row.status, { 'content-type': 'text/html' });
        res.end('<html>private gateway rejection</html>');
        return;
    }
    const upstream = request({ host: '127.0.0.1', port, path: req.url, method, headers: { ...req.headers, cookie: `quantos_session=${row.control ? String(req.headers['x-frontend-g8-session']) : flags.readonly ? 'session-approver' : activeSession}; quantos_csrf=${csrf}`, origin: terminal } }, response => {
        row.status = response.statusCode!;
        if (path === '/v1/settings/sessions/stream') {
            res.writeHead(row.status, { 'content-type': 'text/event-stream' });
            res.flushHeaders();
            streams.add(res);
            response.pipe(res);
            res.on('close', () => { streams.delete(res); response.destroy(); });
            return;
        }
        const output: Buffer[] = [];
        response.on('data', b => output.push(Buffer.from(b)));
        response.on('end', () => {
            let bytes = Buffer.concat(output);
            if (row.status >= 400) {
                try { const code = JSON.parse(bytes.toString()).code; row.errorCode = typeof code === "string" && /^[A-Z_]{1,80}$/.test(code) ? code : "UNSTRUCTURED_REFUSAL"; }
                catch { row.errorCode = "UNSTRUCTURED_REFUSAL"; }
            }
            if (row.status === 200 && !row.control && flags.foreign && path === '/v1/alerts') {
                const v = JSON.parse(bytes.toString());
                v.items[0].accountId = 'aaaaaaaa-1111-4111-8111-111111111111';
                bytes = Buffer.from(JSON.stringify(v));
                row.source = 'SYNTHETIC_FOREIGN_ACCOUNT';
            }
            row.responseHash = hash(bytes);
            if (!row.control && method !== 'GET' && !path.startsWith('/v1/auth/') && [200, 201, 202].includes(row.status)) {
                const v = JSON.parse(bytes.toString());
                receipts.push(v);
            }
            if ((flags.dropPath === path || flags.drop && path.startsWith('/v1/admin/')) && ['POST', 'PUT', 'DELETE'].includes(method) && [200, 201, 202].includes(row.status)) {
                flags.drop = false;
                delete flags.dropPath;
                row.source = 'REFERENCE_COMMITTED_RESPONSE_DROPPED';
                res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length + 1 });
                res.write(bytes.subarray(0, 5));
                setTimeout(() => res.destroy(), 20);
                return;
            }
            res.writeHead(row.status, { 'content-type': path.endsWith('/stream') ? 'text/event-stream' : 'application/json', 'content-length': bytes.length, ...(response.headers['x-stream-id'] ? { 'x-stream-id': response.headers['x-stream-id'] } : {}) });
            res.end(bytes);
        });
    });
    upstream.on('error', () => {
        if (!res.headersSent)
            res.writeHead(502);
        res.end();
    });
    res.on('close', () => upstream.destroy());
    upstream.end(body);
});
export async function control(path: string, body?: unknown, version?: string, options: {
    method?: "GET" | "PUT" | "POST" | "DELETE";
    session?: "session-current" | "session-viewer" | "session-owner" | "session-approver";
} = {}): Promise<{
    status: number;
    body: Record<string, unknown>;
}> {
    const method = options.method ?? (body ? "PUT" : "GET"), write = method !== "GET";
    return new Promise((resolve, reject) => { const req = secureRequest(origin + path, { rejectUnauthorized: false, method, headers: { "x-frontend-g8-control": "1", "x-frontend-g8-session": options.session ?? "session-owner", ...(write ? { "content-type": "application/json", ...(version ? { "if-match": version } : {}), "idempotency-key": crypto.randomUUID(), "x-request-id": crypto.randomUUID(), "x-csrf-token": csrf } : {}) } }, res => { const parts: Buffer[] = []; res.on("data", b => parts.push(Buffer.from(b))); res.on("end", () => resolve({ status: res.statusCode!, body: Buffer.concat(parts).length ? JSON.parse(Buffer.concat(parts).toString()) : {} })); }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined); });
}
export async function authorized(page: Page) { await expect(page.locator('[data-route-access="authorized"]')).toBeVisible(); }
export function installReferenceHooks(mode: "paper" | "shadow" | "assisted-local" | "assisted-mtls-local" = "paper", assistedEnabled = true) {
    test.beforeAll(async () => {
        expect(process.env.DATABASE_URL).toBeUndefined();
        expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
        scratch = await mkdtemp(join(tmpdir(), "quantos-frontend-g8-"));
        execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(scratch, "key.pem"), "-out", join(scratch, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
        proxy.setSecureContext({ key: await readFile(join(scratch, "key.pem")), cert: await readFile(join(scratch, "cert.pem")) });
        await new Promise<void>(r => proxy.listen(4010, "127.0.0.1", r));
    });
    test.beforeEach(async ({ context, page }) => {
        page.on("dialog", dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
        await page.emulateMedia({ colorScheme: "dark" });
        rows = [];
        receipts.length = 0;
        activeSession = 'session-current';
        probes = [];
        fault({});
        await context.addCookies([{ name: "quantos_csrf", value: csrf, url: terminal }]);
        await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
        zone=mode==="assisted-mtls-local"?await ownedZone():undefined;
        child = spawn(resolve("target/debug/bff-gateway"), [], { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...(zone?{QUANTOS_BFF_OWNED_MTLS_DIRECTORY:zone.directory}:{}), GITHUB_SHA: process.env.GITHUB_SHA, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_REFERENCE_CONTEXT: mode, QUANTOS_BFF_OWNED_ASSISTED: (mode === "assisted-local" || mode === "assisted-mtls-local") && assistedEnabled ? "enabled" : "off", QUANTOS_BFF_BIND: "127.0.0.1:0", QUANTOS_BFF_PUBLIC_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });
        await new Promise<void>((done, reject) => {
            const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000);
            child.once("error", e => { clearTimeout(timer); reject(e); });
            let output = "";
            child.stdout!.on("data", b => {
                output += String(b);
                if (output.includes("\n")) {
                    const ready = JSON.parse(output.split("\n")[0]), address = new URL("http://" + ready.address);
                    expect(ready.ready).toBe(true); expect(address.hostname).toBe("127.0.0.1"); expect(isIP(address.hostname)).toBe(4);
                    port = Number(address.port); expect(port).toBeGreaterThan(0);
                    clearTimeout(timer);
                    done();
                }
            });
        });
        await page.bringToFront();
    });
    test.afterEach(async ({ context, page }, info) => {
        if (info.status !== "passed" && !page.isClosed()) {
            await writeFile(info.outputPath("page-state.txt"), await page.locator("main").innerText({ timeout: 1000 }).catch(() => "unavailable"));
            await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true, timeout: 5000 }).catch(() => { });
        }
        await writeFile(info.outputPath("frontend-g8.json"), JSON.stringify({ schema: "quantos-frontend-g8-browser/v1", scenario: info.title, status: info.status, sourceCommit: process.env.GITHUB_SHA, binarySha256: hash(await readFile("target/debug/bff-gateway")), identity: "EXPLICIT_REFERENCE_COOKIE_BRIDGE", cors: "LOOPBACK_PROXY_SUBSTITUTION", mode, businessWrites: mode === "assisted-mtls-local" ? "CORE_L4_PUBLIC_UI_TO_ACTUAL_L02_MTLS_OWNED_PROTOCOL" : mode === "assisted-local" ? "CORE_L03_PUBLIC_DUAL_TO_NATIVE_L01_OWNED_PROTOCOL_PORT" : "PAPER_C01_C07_C08_C09_C10_RECOVERY_ONLY_NOT_ASSISTED_TESTNET", referenceInstance: `owned-process-${port}`, realIdp: "NOT_RUN", realCookieCors: "NOT_RUN", probes, rows }, null, 2));
        await context.close();
        for (const s of streams)
            s.destroy();
        streams.clear();
        proxy.closeAllConnections();
        if (child?.exitCode === null) {
            child.kill();
            await new Promise(r => child.once("close", r));
        }
        await zone?.close();zone=undefined;
    });
    test.afterAll(async () => { proxy.closeAllConnections(); await new Promise<void>(r => proxy.close(() => r())); await rm(scratch, { recursive: true, force: true }); });
}
/** Owner publication for the current valuation port; never a product HTTP upload. */
export async function publishOwnedValuation(ledger:Record<string,unknown>){
 if(!zone)throw Error('Owned mTLS zone required');
 const {createHmac}=await import('node:crypto'),{rename}=await import('node:fs/promises');
 const owner=JSON.parse((await readFile(join(zone.directory,'bff-owner.json'))).toString());
 const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
 const scope={tenantId:ledger.tenantId,workspaceId:ledger.workspaceId,accountId:ledger.accountId},at=new Date().toISOString();
 const value={schemaVersion:'quantos-native-valuation-input.v1',sourceId:'owned-reference-valuation:v1',version:1,scope,basis:'EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS',originLedgerHash:'sha256:'+hash(canonical({schemaVersion:'quantos-native-ledger-checkpoint.v1',scope,entries:[],anchor:{sequence:0,head:null}})),openingAt:owner.createdAt,cashSourceRef:'browser:owned-opening-cash',quoteCashAtOpening:'10000',realizedPnlBeforeOriginToday:'-5',quoteCurrency:'USDT',ledgerHash:ledger.ledgerHash,ledgerAnchor:ledger.anchor,asOf:at,validUntil:new Date(Date.parse(at)+30000).toISOString(),cashCoverageThrough:at,accountStatus:'active',accountStatusAt:at,statusSourceRef:'browser:owned-status',marks:(ledger.positions as {symbol:string;quantity:string}[]).filter(p=>p.quantity!=='0').map(p=>({symbol:p.symbol,price:'1100',sourceRef:'browser:independent-owned-mark',observedAt:at,quality:'normal'}))};
 const packet={value,signature:createHmac('sha256',Buffer.from(owner.keys[3])).update(canonical(['quantos-l04-durable/v1','valuation-input',value])).digest('hex')};
 const temp=join(zone.directory,'browser-valuation.tmp');await writeFile(temp,JSON.stringify(packet),{mode:0o600});await rename(temp,join(zone.directory,'valuation-input.json'));
 return{scope:'OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET',version:1};
}
