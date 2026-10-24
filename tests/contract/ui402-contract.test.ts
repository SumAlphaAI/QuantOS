import {it,expect} from 'vitest';
import {bffZodSchemas} from '../../packages/api-client/src/bff-gen/quantos-bff.zod';
const id='11111111-1111-4111-8111-111111111111';
const order={orderId:id,commandId:id,accountId:id,venue:'OWNED_PAPER',venueKind:'mock',symbol:'BTCUSDT',intent:'open',side:'buy',quantity:'1',status:'filled',filledQuantity:'1',averageFillPrice:'100',fills:[{fillId:id,quantity:'1',price:'100',at:'2026-10-24T00:00:00Z'}],mode:'paper',correlationId:id,submittedAt:'2026-10-24T00:00:00Z'};
it('Order.productType is optional: existing C09 payload remains unchanged',()=>expect(bffZodSchemas.Order.parse(order)).toEqual(order));
it('explicit spot product is preserved by generated C09 schema for chart binding',()=>expect(bffZodSchemas.Order.parse({...order,productType:'spot'}).productType).toBe('spot'));
it('unsupported product cannot silently become spot',()=>{for(const productType of ['perpetual','','SPOT',null])expect(bffZodSchemas.Order.safeParse({...order,productType}).success).toBe(false);});
