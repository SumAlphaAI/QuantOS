import {verify} from '../../../../scripts/core-x06-source-review.mjs';
const r=verify();console.log(JSON.stringify({status:r.status,sourceCommit:r.sourceCommit,inputs:r.inputs.length,rawFiles:r.files.length,executions:r.executions.length,boundary:r.boundary}));
