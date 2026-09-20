import {create} from "@bufbuild/protobuf";
import {describe, it, expect} from "vitest";
import {validateProtocolMessage} from "../src/proto-validation.js";
import {CommandMetadataSchema} from "../src/gen/quantos/common/v1/common_pb.js";
import {DataSnapshotSchema, ResearchArtifactSchema} from "../src/gen/quantos/research/v1/research_pb.js";
import {StrategyReleaseSchema, SignalSchema} from "../src/gen/quantos/strategy/v1/strategy_pb.js";
import {TradeProposalSchema, RiskDecisionSchema, TradeCommandSchema, OrderSchema, FillSchema, PositionSchema} from "../src/gen/quantos/trading/v1/trading_pb.js";
import {EventEnvelopeSchema, GetEventRequestSchema, GetEventResponseSchema, ListEventsRequestSchema, ListEventsResponseSchema} from "../src/gen/quantos/events/v1/events_pb.js";
import {GetMetadataRequestSchema, GetMetadataResponseSchema, HealthRequestSchema, HealthResponseSchema, ExecuteRequestSchema, ExecuteResponseSchema, StreamExecuteRequestSchema, StreamExecuteResponseSchema, CancelRequestSchema, CancelResponseSchema} from "../src/gen/quantos/engine/v1/engine_pb.js";
const metadata = () => create(CommandMetadataSchema, {requestId:"r",tenantId:"t",workspaceId:"w",correlationId:"c",actor:{actorId:"a",actorKind:1},mode:2,environment:2,issuedAt:{seconds:1n}});
describe("all protocol metadata boundaries", () => {
it("DataSnapshot rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(DataSnapshotSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(DataSnapshotSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("ResearchArtifact rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(ResearchArtifactSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(ResearchArtifactSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("StrategyRelease rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(StrategyReleaseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(StrategyReleaseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("Signal rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(SignalSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(SignalSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("TradeProposal rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(TradeProposalSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(TradeProposalSchema, {metadata:value, signal:{metadata:metadata()}})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("RiskDecision rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(RiskDecisionSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(RiskDecisionSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("TradeCommand rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(TradeCommandSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(TradeCommandSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("Order rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(OrderSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(OrderSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("Fill rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(FillSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(FillSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("Position rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(PositionSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(PositionSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("EventEnvelope rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(EventEnvelopeSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(EventEnvelopeSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("GetEventRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(GetEventRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(GetEventRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("GetEventResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(GetEventResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(GetEventResponseSchema, {metadata:value, event:{metadata:metadata()}})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("ListEventsRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(ListEventsRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(ListEventsRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("ListEventsResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(ListEventsResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(ListEventsResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("GetMetadataRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(GetMetadataRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(GetMetadataRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("GetMetadataResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(GetMetadataResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(GetMetadataResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("HealthRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(HealthRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(HealthRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("HealthResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(HealthResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(HealthResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("ExecuteRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(ExecuteRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(ExecuteRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("ExecuteResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(ExecuteResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(ExecuteResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("StreamExecuteRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(StreamExecuteRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(StreamExecuteRequestSchema, {request:{metadata:value}})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("StreamExecuteResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(StreamExecuteResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(StreamExecuteResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("CancelRequest rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(CancelRequestSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(CancelRequestSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("CancelResponse rejects every identity gap", () => {
expect(()=>validateProtocolMessage(create(CancelResponseSchema))).toThrow();
for (let gap=0;gap<11;gap++) {const value=metadata(); switch(gap) {case 0:value.requestId="";break;case 1:value.tenantId="";break;case 2:value.workspaceId="";break;case 3:value.correlationId="";break;case 4:value.actor=undefined;break;case 5:value.actor!.actorId="";break;case 6:value.actor!.actorKind=0;break;case 7:value.mode=0;break;case 8:value.environment=0;break;case 9:value.issuedAt=undefined;break;}
const run=()=>validateProtocolMessage(create(CancelResponseSchema, {metadata:value})); if(gap<10) expect(run).toThrow(); else expect(run).not.toThrow(); } });
it("rejects nested DataSnapshot",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"dataSnapshot",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested ResearchArtifact",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"researchArtifact",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested Signal",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"signal",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested TradeProposal",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"tradeProposal",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested RiskDecision",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"riskDecision",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested TradeCommand",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"tradeCommand",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested Order",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"order",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested Fill",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"fill",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
it("rejects nested Position",()=>{const event=create(EventEnvelopeSchema,{metadata:metadata(),payload:{case:"position",value:{}}}); for(const message of [event,create(GetEventResponseSchema,{metadata:metadata(),event}),create(ListEventsResponseSchema,{metadata:metadata(),events:[event]})]) expect(()=>validateProtocolMessage(message)).toThrow();});
});
