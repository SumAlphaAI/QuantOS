const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const out='docs/audit/evidence/r02-review-20261007',tmp='crates/quantos-storage/tests/r02_audit_target.rs';
if(fs.existsSync(tmp))throw Error('AUDIT_TEMP_EXISTS');
fs.copyFileSync(path.join(out,'target_storage_probe_attempt02.rs'),tmp);
let r;try{const {targetUrl}=require(path.resolve('scripts/lib/r01-db.cjs'));r=spawnSync('cargo',['test','-p','quantos-storage','--locked','--test','r02_audit_target','--','--nocapture','--test-threads=1'],{env:{...process.env,DATABASE_URL:(()=>{const u=new URL(targetUrl());u.searchParams.set('connect_timeout','10');return u.toString();})()},encoding:'utf8',timeout:120000});
let log=(r.stdout||'')+(r.stderr||'');for(const[k,v]of Object.entries(process.env))if(/(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)$/.test(k)&&v.length>10)log=log.split(v).join('[REDACTED]');
fs.writeFileSync(path.join(out,'native-target-attempt03-configured.log'),log);console.log('AUDIT_NATIVE_TARGET_EXIT',r.status);process.exitCode=r.status??1;
}finally{fs.unlinkSync(tmp);}
