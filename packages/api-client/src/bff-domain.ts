/** Explicit domain-to-page serialization. Domain authority stays in the provider. */
import { bffZodSchemas } from "./bff-gen/quantos-bff.zod.js";
import type { components } from "./bff-gen/quantos-bff.js";
import { RuntimeMode, Environment, DataQuality, type DecimalValue, type MoneyValue, type CommandMetadata } from "./gen/quantos/common/v1/common_pb.js";
import { OrderStatus, ProposalAction } from "./gen/quantos/trading/v1/trading_pb.js";
import { validateCommandMetadata } from "./proto-validation.js";
import { toJson } from "@bufbuild/protobuf";
import { TimestampSchema, type Timestamp } from "@bufbuild/protobuf/wkt";
type Wire=components["schemas"];
function mapped<T>(value:number,values:Partial<Record<number,T>>):T {
  const result=values[value];if(result===undefined)throw new Error("Unknown or unsupported domain enum; action blocked");return result;
}
export const decimalToBff=(value:DecimalValue):Wire["DecimalValue"]=>bffZodSchemas.DecimalValue.parse(value.value);
export const timestampToBff=(value:Timestamp):Wire["DateTime"]=>bffZodSchemas.DateTime.parse(toJson(TimestampSchema,value));
export function moneyToBff(value:MoneyValue):Wire["MoneyValue"] {
  if(value.units < -(2n**63n)||value.units >= 2n**63n)throw Error("Money int64 overflow");
  return bffZodSchemas.MoneyValue.parse({currencyCode:value.currencyCode,units:value.units.toString(),nanos:value.nanos});
}
export const modeToBff=(value:RuntimeMode):Wire["RuntimeMode"]=>mapped(value,{[RuntimeMode.RESEARCH]:"research",[RuntimeMode.PAPER]:"paper",[RuntimeMode.SHADOW]:"shadow",[RuntimeMode.ASSISTED_LIVE]:"assisted_live"});
export const environmentToBff=(value:Environment):Wire["Environment"]=>mapped(value,{[Environment.LOCAL]:"dev",[Environment.TEST]:"dev",[Environment.STAGING]:"staging",[Environment.PRODUCTION]:"prod"});
export const qualityToBff=(value:DataQuality):Wire["DataQuality"]=>mapped(value,{[DataQuality.PENDING]:"provisional",[DataQuality.PASSED]:"verified",[DataQuality.DEGRADED]:"degraded",[DataQuality.FAILED]:"failed"});
export const proposalActionToBff=(value:ProposalAction):Wire["TradeProposal"]["action"]=>mapped(value,{[ProposalAction.BUY]:"buy",[ProposalAction.SELL]:"sell",[ProposalAction.REDUCE]:"reduce"});
export const orderStatusToBff=(value:OrderStatus):Wire["OrderStatus"]=>mapped(value,{[OrderStatus.DRAFT]:"draft",[OrderStatus.SUBMITTED]:"submitted",[OrderStatus.ACCEPTED]:"accepted",[OrderStatus.REJECTED]:"rejected",[OrderStatus.PARTIALLY_FILLED]:"partially_filled",[OrderStatus.FILLED]:"filled",[OrderStatus.CANCELLED]:"cancelled",[OrderStatus.EXPIRED]:"expired"});
export function sessionToBff(metadata:CommandMetadata,details:Pick<Wire["SessionContext"],"accountId"|"capabilities"|"mfaState"|"expiresAt">):Wire["SessionContext"] {
  validateCommandMetadata(metadata);
  return bffZodSchemas.SessionContext.parse({actorId:metadata.actor!.actorId,tenantId:metadata.tenantId,workspaceId:metadata.workspaceId,
    mode:modeToBff(metadata.mode),environment:environmentToBff(metadata.environment),accountId:details.accountId,
    capabilities:details.capabilities,mfaState:details.mfaState,expiresAt:details.expiresAt});
}
