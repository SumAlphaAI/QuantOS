import {verify} from '../../../../scripts/core-l4-cash.mjs';
const r=verify();console.log(JSON.stringify({status:r.status,sourceCommit:r.sourceCommit,inputs:r.inputs.length,rawFiles:r.files.length,checks:r.executions.length,boundary:r.boundary}));
