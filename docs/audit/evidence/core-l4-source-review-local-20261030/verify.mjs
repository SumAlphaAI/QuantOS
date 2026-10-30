import {verify} from '../../../../scripts/core-l4-source-review.mjs';
const r=verify();console.log(JSON.stringify({status:r.status,sourceCommit:r.sourceCommit,inputs:r.inputs.length,rawFiles:r.files.length,checks:r.executions.length,accepted:r.accepted,unknown:r.unknown,gap:r.gap,boundary:r.boundary}));
