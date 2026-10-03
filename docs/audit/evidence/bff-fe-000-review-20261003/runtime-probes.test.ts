// Audit reproductions: passing tests here confirm the reported defects exist.
import { describe, expect, it } from 'vitest';
import { consumeSse, SseStreamReducer, type SseEventEnvelope } from '../../../../packages/api-client/src/sse';
import { setupServer } from 'msw/node';
import { handlers } from '../../../../tests/contract/handlers';
describe('A1 independent SSE probes (current defect reproductions)', () => {
  const event:SseEventEnvelope={streamId:'11111111-1111-4111-8111-111111111111',sequence:1,
    eventId:'22222222-2222-4222-8222-222222222222',correlationId:'33333333-3333-4333-8333-333333333333',
    occurredAt:'2026-10-03T00:00:00Z',payloadVersion:'unsupported-v999',payload:{type:'order_filled'}};
  it('unknown payloadVersion is applied instead of rejected', () => {
    expect(new SseStreamReducer().accept(event).type).toBe('apply');
  });
  it('500 ends consumption immediately without recovery', async () => {
    let calls=0;
    const consumer=consumeSse({url:'https://bff.invalid/stream', fetchImpl:async()=>{
      calls++; return new Response(null,{status:500});
    }});
    await expect(consumer.next()).rejects.toThrow('HTTP 500');
    expect(calls).toBe(1);
  });
  it('cross-origin SSE fetch has no include credentials', async () => {
    let init:RequestInit|undefined;
    for await(const action of consumeSse({url:'https://bff.invalid/stream',fetchImpl:async(_url,options)=>{
      init=options;return new Response(null,{status:403});
    }})) expect(action.type).toBe('closed');
    expect(init?.credentials).toBeUndefined();
  });
});
describe('A1 independent MSW probes (current defect reproductions)', () => {
  it('cookie session is denied by bearer-only mock and uses undeclared status', async () => {
    const server=setupServer(...handlers);server.listen({onUnhandledRequest:'error'});
    try {
      const response=await fetch('http://localhost:4010/v1/session',{headers:{cookie:'quantos_session=synthetic'}});
      expect(response.status).toBe(403);
    } finally {server.close();}
  });
  it('draft mock accepts invalid body without required Idempotency-Key', async () => {
    const server=setupServer(...handlers);server.listen({onUnhandledRequest:'error'});
    try {
      const response=await fetch('http://localhost:4010/v1/strategies/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/draft',{
        method:'PUT', headers:{'if-match':'draft-v3','content-type':'application/json'},body:JSON.stringify({name:'invalid-body'})
      });
      expect(response.status).toBe(200);
    } finally {server.close();}
  });
});
