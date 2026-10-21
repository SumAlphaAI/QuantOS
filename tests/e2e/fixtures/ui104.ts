import { ui104SettingsFixture } from "../../../apps/terminal/src/settings/fixture";
export const id="11111111-1111-4111-8111-111111111111", bff="https://bff.ui104.test";
export const context=()=>({actorId:id,tenantId:id,workspaceId:id,accountId:id,mode:"shadow",environment:"dev",mfaState:"verified",expiresAt:new Date(Date.now()+300000).toISOString(),capabilities:["settings.read","settings.write","audit:read"]});
export const bundle=()=>structuredClone(ui104SettingsFixture);
