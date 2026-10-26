import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,validateBoundary,validateJourney} from './core-x06-review.mjs';
test('X06 scoped engineering status does not grant integration or runtime',()=>validateBoundary(boundary()));
for(const key of Object.keys(boundary()))test('reject X06 promotion or drift '+key,()=>{const r=boundary();r[key]=typeof r[key]==='boolean'?!r[key]:'READY';assert.throws(()=>validateBoundary(r));});
const fixture=()=>({order:{orderId:'order',mode:'paper',venueKind:'mock',fills:[]},chain:{complete:true,items:[{eventId:'event',objectRef:'order'}]},export:{sha256:'a'.repeat(64),sizeBytes:1,watermarked:true},externalRequests:[],productionCredentialsUsed:false,externalPublished:false,performanceAccepted:false,pages:['/portfolio','/proposals','/approvals','/orders','/audit','/operations/health','/admin/capabilities']});
test('X06 same-instance journey must retain reference and export bindings',()=>validateJourney(fixture()));
for(const mutation of ['live','venue','chain','watermark','external','performance','pages'])test('reject false X06 closure '+mutation,()=>{const r=fixture();if(mutation==='live')r.order.mode='assisted_live';if(mutation==='venue')r.order.venueKind='external';if(mutation==='chain')r.chain.complete=false;if(mutation==='watermark')r.export.watermarked=false;if(mutation==='external')r.externalRequests=['https://venue.invalid'];if(mutation==='performance')r.performanceAccepted=true;if(mutation==='pages')r.pages=[];assert.throws(()=>validateJourney(r));});
