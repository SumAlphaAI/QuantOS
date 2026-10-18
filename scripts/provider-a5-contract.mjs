import {operations as reconciliation} from './bff-fe-009-contract.mjs';
import {operations as performance} from './bff-fe-008-contract.mjs';
import {operations as operationsApi} from './bff-fe-010-contract.mjs';
export const operations=[...reconciliation,...performance,...operationsApi];
export const domains=[['reconciliation','scripts/test-bff-fe-009-http.mjs'],['performance','scripts/test-bff-fe-008-http.mjs'],['operations','scripts/test-bff-fe-010-http.mjs']];
