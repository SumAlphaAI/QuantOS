import {bffZodSchemas,type BffComponents} from "@sumalpha/api-client";
export type Instrument = BffComponents["schemas"]["MarketInstrument"];
export type Quote = BffComponents["schemas"]["VenueQuote"];
export type Watchlist = BffComponents["schemas"]["MarketWatchlist"];
export type MarketRow = {instrument: Instrument; quote: Quote};
const nonblank = (s: string) => Boolean(s.trim());
const decimal = (s: string) => /^(0|[1-9]\d*)(\.\d+)?$/.test(s) && /[1-9]/.test(s);
export function catalog(raw: unknown): Instrument[] {
 const value = bffZodSchemas.MarketCatalog.parse(raw);
 if (value.items.length>256 || new Set(value.items.map(i=>i.instrumentId)).size !== value.items.length) throw Error("Duplicate market identity");
 for (const i of value.items) if(i.instrumentId !== `${i.venue}:${i.productType}:${i.canonicalSymbol}` || !i.intervals.length || !i.timezones.length || !i.intervals.every(nonblank) || !i.timezones.every(nonblank) || !decimal(i.lotSize) || !decimal(i.minNotional)) throw Error("Invalid market capability");
 return value.items;
}
export function quote(raw: unknown, i: Instrument, now: number): Quote {
 const quotes = bffZodSchemas.VenueQuotes.parse(raw);
 if(quotes.items.length!==1) throw Error("Exact venue quote required");
 const q=quotes.items[0],p=q.provenance;
 if(q.instrumentId!==i.instrumentId || q.canonicalSymbol!==i.canonicalSymbol || q.productType!==i.productType || p.venue!==i.venue || ![p.source,p.license,p.approvalRef,p.approvalVersion].every(nonblank) || Date.parse(p.asOf)>now || !Number.isSafeInteger(q.sequence) || !Number.isSafeInteger(p.latencyMs) || p.latencyMs<0 || q.lotSize!==i.lotSize || q.minNotional!==i.minNotional || [q.bid,q.ask,q.mid,q.lastPrice].some(v=>v!==null&&!decimal(v)) || (q.priceKind==='top_of_book' && (!i.topOfBook || [q.bid,q.ask,q.mid].some(v=>v===null))) || (q.priceKind==='last_trade' && (q.lastPrice===null || [q.bid,q.ask,q.mid].some(v=>v!==null)))) throw Error("Market quote binding failed");
 return q;
}
export function watchlist(raw: unknown): Watchlist {
 const w=bffZodSchemas.MarketWatchlist.parse(raw);
 if(!w.objectVersion.trim() || w.instrumentIds.length>100 || new Set(w.instrumentIds).size!==w.instrumentIds.length || w.instrumentIds.some(id=>!id.trim())) throw Error("Invalid watchlist");
 return w;
}
export const sameIds=(a:string[],b:string[])=>JSON.stringify(a)===JSON.stringify(b);
