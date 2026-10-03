import {describe,expect,it} from "vitest";
import {create,fromBinary,toBinary,toJson} from "@bufbuild/protobuf";
import {timestampFromDate,TimestampSchema} from "@bufbuild/protobuf/wkt";
import { DecimalValueSchema,MoneyValueSchema,CommandMetadataSchema,RuntimeMode,Environment,DataQuality } from "../src/gen/quantos/common/v1/common_pb.js";
import {OrderStatus,ProposalAction} from "../src/gen/quantos/trading/v1/trading_pb.js";
import {decimalToBff,timestampToBff,moneyToBff,modeToBff,environmentToBff,qualityToBff,orderStatusToBff,proposalActionToBff,sessionToBff} from "../src/bff-domain.js";
const uuid="11111111-1111-4111-8111-111111111111";
describe("F03 domain / BFF serialization",()=>{
 it("preserves decimal precision and signed int64 money across actual protobuf serialization",()=>{
  const decimal=create(DecimalValueSchema,{value:"9007199254740993.00000001"});expect(decimalToBff(fromBinary(DecimalValueSchema,toBinary(DecimalValueSchema,decimal)))).toBe(decimal.value);
  const money=create(MoneyValueSchema,{currencyCode:"USD",units:9223372036854775807n,nanos:999999999});
  const wire=moneyToBff(fromBinary(MoneyValueSchema,toBinary(MoneyValueSchema,money)));
  expect(wire).toEqual(toJson(MoneyValueSchema,money));
  expect(()=>moneyToBff({...money,units:2n**63n})).toThrow("overflow");
  expect(()=>moneyToBff({...money,units:-(2n**63n)-1n})).toThrow("overflow");
  expect(()=>moneyToBff({...money,nanos:1000000000})).toThrow();
  expect(()=>decimalToBff({...decimal,value:''})).toThrow();
 });
 it("serializes actual Proto timestamps as UTC without discarding nanoseconds",()=>{
  const timestamp=create(TimestampSchema,{seconds:1790985600n,nanos:123456789});
  expect(timestampToBff(fromBinary(TimestampSchema,toBinary(TimestampSchema,timestamp)))).toBe('2026-10-03T00:00:00.123456789Z');
 });
 it("maps approved enum differences and rejects unknown or unsupported capabilities",()=>{
  expect([modeToBff(RuntimeMode.PAPER),environmentToBff(Environment.TEST),qualityToBff(DataQuality.PASSED),orderStatusToBff(OrderStatus.PARTIALLY_FILLED),proposalActionToBff(ProposalAction.REDUCE)]).toEqual(["paper","dev","verified","partially_filled","reduce"]);
  for(const value of [0,999])expect(()=>modeToBff(value)).toThrow();
  expect(()=>modeToBff(RuntimeMode.GUARDED_LIVE)).toThrow();expect(()=>proposalActionToBff(ProposalAction.HOLD)).toThrow();
 });
 it("injects trusted metadata and strips domain-only actor details",()=>{
  const metadata=create(CommandMetadataSchema,{requestId:uuid,tenantId:uuid,workspaceId:uuid,actor:{actorId:uuid,actorKind:1,displayName:"internal"},correlationId:uuid,mode:RuntimeMode.PAPER,environment:Environment.STAGING,issuedAt:timestampFromDate(new Date())});
  const wire=sessionToBff(metadata,{accountId:uuid,capabilities:[],mfaState:"verified",expiresAt:"2026-10-03T00:00:00Z"});
  expect(wire.actorId).toBe(uuid);expect(wire.environment).toBe("staging");expect(wire).not.toHaveProperty("actor");
  const details={accountId:uuid,capabilities:[],mfaState:'verified' as const,expiresAt:'2026-10-03T00:00:00Z',actorId:'22222222-2222-4222-8222-222222222222',tenantId:'33333333-3333-4333-8333-333333333333'};
  expect(sessionToBff(metadata,details).actorId).toBe(uuid);expect(sessionToBff(metadata,details).tenantId).toBe(uuid);
  expect(()=>sessionToBff({...metadata,actor:undefined},{accountId:uuid,capabilities:[],mfaState:"verified",expiresAt:"2026-10-03T00:00:00Z"})).toThrow();
 });
});
