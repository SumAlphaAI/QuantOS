// UNIT-ONLY normalized shapes/excerpts; neither signed receipts nor an assessment source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {componentCoverage} from './s2-service-coverage.mjs';
export function componentFixture(){
 const data=JSON.parse(readFileSync(new URL('./fixtures/s2-service-components.json',import.meta.url)));assert.equal(data.testOnly,true);
 const rows=new Map(data.rows.map(c=>[c.id,c])),raw=new Map(Object.entries(data.raw));
 const read=path=>path==='unit-node'?{checks:[...rows.values()]}:JSON.parse(raw.get(path)),readLog=path=>raw.get(path);
 const local={observedSourceCommit:data.observedSourceCommit,nodes:[{nodeId:'UNIT_ONLY',manifest:'unit-node'}]};
 return{local,read,readLog,raw,rows,run:()=>componentCoverage(local,{read,readLog})};
}
