import { bffZodSchemas, type BffComponents, type SseEventEnvelope } from '@sumalpha/api-client';
import type { RouteContext } from '../auth/route-access';
import { alertFact } from '../operations/gateway';
export type Portfolio = BffComponents['schemas']['PortfolioView'];
export type Risk = BffComponents['schemas']['RiskView'];
export type Snapshot = { portfolio: Portfolio; risk: Risk };
export const portfolioPolicy = { maxAgeMs: 60_000, pollMs: 2_000, maxUnverifiedMs: 8_000, frameChars: 262_144 } as const;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
export function decimal(value: string, nonnegative = false) {
  if (value.length > 160 || !decimalPattern.test(value) || nonnegative && value.startsWith('-')) throw Error('Invalid decimal');
  return value;
}
/** Exact string formatting: no monetary/quantity conversion to binary floating point. */
export function money(value: Portfolio['pnl']) {
  if (!/^-?(0|[1-9]\d*)$/.test(value.units) || value.units.length > 30 || !Number.isInteger(value.nanos) || Math.abs(value.nanos) >= 1e9 || BigInt(value.units) > 0n && value.nanos < 0 || BigInt(value.units) < 0n && value.nanos > 0 || !/^[A-Z]{3}$/.test(value.currencyCode)) throw Error('Invalid money');
  if (BigInt(value.units) < -(2n ** 63n) || BigInt(value.units) >= 2n ** 63n) throw Error('Money units exceed int64');
  const negative = BigInt(value.units) < 0n || value.nanos < 0;
  const fraction = String(Math.abs(value.nanos)).padStart(9, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${value.units.replace(/^-/, '')}${fraction ? '.' + fraction : ''} ${value.currencyCode}`;
}
export function snapshot(raw: unknown, accountId: string, now = Date.now()): Snapshot {
  const pair = raw as Snapshot;
  const p = bffZodSchemas.PortfolioView.parse(pair?.portfolio), r = bffZodSchemas.RiskView.parse(pair?.risk);
  if (p.accountId !== accountId || r.accountId !== accountId || p.asOf !== r.asOf || !Number.isFinite(now) || Date.parse(p.asOf) > now || p.positions.length > 1000 || new Set(p.positions.map(v => v.symbol)).size !== p.positions.length || !r.objectVersion || !/^\d{1,30}$/.test(r.objectVersion) || new Set(r.hitRules).size !== r.hitRules.length || new Set(r.limitIds).size !== r.limitIds.length || r.hitRules.length !== r.limitIds.length || r.hitRules.some(v => !v || v.length > 200)) throw Error('Portfolio scope/consistency mismatch');
  for (const row of p.positions) { if (!row.symbol || row.symbol.length > 100) throw Error('Invalid position'); decimal(row.quantity, true); decimal(row.avgPrice, true); }
  decimal(p.exposure, true); money(p.pnl);
  const killed = r.hitRules.some(v => v === 'GlobalKill' || v === 'AccountKill');
  if (killed !== (r.killSwitch.state === 'engaged')) throw Error('Kill switch facts disagree');
  return structuredClone({ portfolio: p, risk: r });
}
export function fresh(pair: Snapshot | undefined, now = Date.now()) {
  return !!pair && Number.isFinite(now) && !pair.portfolio.stale && Date.parse(pair.portfolio.asOf) <= now && now - Date.parse(pair.portfolio.asOf) < portfolioPolicy.maxAgeMs;
}
export function riskAlerts(raw: unknown[], context: RouteContext) {
  if (raw.length > 100) throw Error('Oversized risk alert page');
  const rows = raw.map(v => alertFact(v, context.accountId));
  if (new Set(rows.map(v => v.alertId)).size !== rows.length || rows.some(v => v.domain !== 'risk' || v.mode !== context.mode)) throw Error('Risk alert scope mismatch');
  return rows;
}
/** C06 journal is dense; atomically accept the portfolio and kill broadcast. */
export class PortfolioFacts {
  private stream?: string;
  private sequence = 0;
  private value?: Snapshot;
  private closed = false;
  constructor(readonly accountId: string) { bffZodSchemas.UUID.parse(accountId); }
  get current() { return this.value && structuredClone(this.value); }
  get afterSequence() { return this.sequence; }
  revoke() { this.closed = true; this.value = undefined; this.stream = undefined; this.sequence = 0; }
  seed(raw: unknown, now?: number) { if (this.closed) throw Error('Portfolio revoked'); this.accept(snapshot(raw, this.accountId, now)); }
  private accept(pair: Snapshot) {
    if (this.value && (Date.parse(pair.portfolio.asOf) < Date.parse(this.value.portfolio.asOf) || BigInt(pair.risk.objectVersion!) < BigInt(this.value.risk.objectVersion!) || pair.risk.objectVersion === this.value.risk.objectVersion && pair.risk.killSwitch.state !== this.value.risk.killSwitch.state)) throw Error('Portfolio regressed');
    this.value = pair;
  }
  apply(raw: SseEventEnvelope, now = Date.now()) {
    if (this.closed) throw Error('Portfolio revoked');
    const e = bffZodSchemas.StreamEvent.parse(raw);
    if (e.payload.type === 'permission_revoked') { this.revoke(); throw Object.assign(Error('Portfolio revoked'), { status: 403 }); }
    if (e.payload.type !== 'portfolio' || this.stream && this.stream !== e.streamId || !Number.isSafeInteger(e.sequence) || e.sequence < 1) throw Error('Portfolio stream identity mismatch');
    const pair = snapshot(e.payload, this.accountId, now);
    if (e.sequence <= this.sequence) return false;
    if (e.sequence !== this.sequence + 1) throw Error('Portfolio stream gap');
    this.accept(pair); this.stream = e.streamId; this.sequence = e.sequence; return true;
  }
}
