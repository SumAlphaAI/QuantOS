import assert from 'node:assert/strict';import fs from 'node:fs';
export function validateCoverage(report,branches=false){
 const files=report.data.flatMap(d=>d.files);const result=[];
 const declarations=fs.readFileSync('services/market-ingestor/src/cli.rs','utf8');assert(!/\b(?:fn|impl)\s/.test(declarations),'COV-R01-01 only allows generated parser declarations');
 for(const suffix of['crates/quantos-market/src/lib.rs','crates/quantos-market/src/durable.rs','services/market-ingestor/src/main.rs','services/market-ingestor/src/binance.rs']){
  const matched=files.filter(f=>f.filename.endsWith(suffix));assert.equal(matched.length,1,`missing/duplicate ${suffix}`);const f=matched[0];
  const row={file:suffix,lines:f.summary.lines,regions:f.summary.regions,branches:f.summary.branches};
  for(const [metric,minimum]of [['lines',90],['regions',85],...(branches?[['branches',85]]:[])]) {const m=row[metric];assert(m?.count>0 && m.covered>=0 && m.covered<=m.count,`invalid ${suffix} ${metric}`);assert(m.covered/m.count*100>=minimum,`${suffix} ${metric}: ${m.percent}% < ${minimum}%`);}
  result.push(row);
 }
 return{schema:'quantos-r01-coverage/v1',status:'PASS',requireBranches:branches,files:result};
}
if(process.argv[1]?.endsWith('check-r01-coverage.mjs')){console.log(JSON.stringify(validateCoverage(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),process.argv.includes('--require-branches')),null,2));}
