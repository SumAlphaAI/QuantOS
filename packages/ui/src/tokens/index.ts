import tokens from "./tokens.json" with { type: "json" };

export type ThemeName = "dark" | "light";
export type Density = keyof typeof tokens.density & string;
export type TaskState = (typeof tokens.stateEnum.task)[number];
export type RiskState = (typeof tokens.stateEnum.risk)[number];
export type OrderState = (typeof tokens.stateEnum.order)[number];
export type MarketState = (typeof tokens.stateEnum.market)[number];
export type ReconciliationState = (typeof tokens.stateEnum.reconciliation)[number];

export const designTokens = tokens;
export default designTokens;
