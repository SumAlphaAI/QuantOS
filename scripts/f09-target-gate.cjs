const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { executeTarget } = require('./lib/development-target-command.cjs');
const { openConnection } = require('./lib/r02-chain-connection.cjs');
const { retireF09Fixtures, validateF09Cleanup } = require('./lib/f09-fixtures.cjs');
const { validateF09MigrationLedger } = require('./lib/f09-migration-ledger.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f09/target.json');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const fixtureRun=crypto.randomUUID(), fixtureName='capacity-fixtures-'+fixtureRun+'.jsonl', fixtureManifest=path.join(root,'artifacts/f09',fixtureName);
const cancellation=new AbortController();
const terminate=()=>cancellation.abort();process.on('SIGTERM',terminate);process.on('SIGINT',terminate);
const connectionPhase={value:'CONFIGURATION'};
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const receipt = {
  schema: 'quantos-f09-target-gate/v3', sourceCommit, dirty,
  targetClass: 'test-supabase-postgresql', status: 'RUNNING', checks: [],
  acceptanceScope: 'F09 development database and Engine component probes',
  f09Accepted: false,
  remainingDevelopmentAcceptance: [],
  deferredToRelease: ['same-SHA remote CI and Nightly receipts'],
  deferredToL04: [
    'nine deployed business metric producers and one-minute monitor',
    'cross-service same-chain fault exercises and secret leak scan',
    'sustained live thresholds, dashboard queries and notification delivery',
  ],
  startedAt: new Date().toISOString(),
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function run(command, args, logName, env = process.env) {
  const phase=logName||command+' '+args.join(' '); receipt.phase=phase;
  const record={command,args,phase,status:'RUNNING'};receipt.commands??=[];receipt.commands.push(record);save();
  const result=await executeTarget(command,args,{cwd:root,env:{...env,QUANTOS_F09_FIXTURE_RUN:fixtureRun,QUANTOS_F09_FIXTURE_MANIFEST:fixtureManifest},timeoutMs:logName==='postgres-exercises.log'?900000:300000,abortSignal:cancellation.signal,onStart:progress=>{Object.assign(record,progress);save();}});
  const {output:outputText,...diagnostics}=result;Object.assign(record,diagnostics,{status:result.exitCode===0?'PASS':'FAIL'});
  if(logName){const logPath=path.join(root,'artifacts/f09',logName);fs.writeFileSync(logPath,outputText);receipt.logs??={};receipt.logs[logName]=crypto.createHash('sha256').update(outputText).digest('hex');}
  receipt.secretLeakDetected||=result.secretLeakDetected;save();process.stdout.write(outputText);
  if(result.exitCode!==0)throw Object.assign(Error('F09 command failed: '+phase),{code:result.errorCode||'COMMAND_FAILED'});
  return outputText;
}
function checkpoint(value){receipt.checks.push(value);save();}

function traceId(outputText, pattern) {
  const id = outputText.match(pattern)?.[1];
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new Error('F09 write entrypoint did not emit a checked correlation ID');
  }
  return id;
}


async function main() {
  save();
  if (dirty) throw new Error('F09 target Gate requires a clean exact-SHA checkout');
  const rawDatabase = process.env.DATABASE_URL;
  const rawApi = process.env.SUPABASE_URL;
  if (!rawDatabase || !rawApi) {
    throw new Error('F09 Supabase database and API URLs are required');
  }
  const database = new URL(rawDatabase);
  const api = new URL(rawApi);
  if (!database.hostname.endsWith('.supabase.com') || !api.hostname.endsWith('.supabase.co')) {
    throw new Error('F09 target Gate requires the configured test Supabase project');
  }
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.').at(-1);
  const apiRef = api.hostname.split('.')[0];
  if (!databaseRef || databaseRef !== apiRef || database.port === '6543') {
    throw new Error('F09 target Gate requires the same project and a direct/session PostgreSQL endpoint');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.existsSync(caPath)) {
    throw new Error('F09 target Gate requires QUANTOS_BFF_SSLROOTCERT');
  }
  receipt.targetRefHash = crypto.createHash('sha256')
    .update(`${database.hostname}/${api.hostname}`).digest('hex').slice(0, 16);
  receipt.bootstrapConnection={};connectionPhase.value='INITIAL_CONNECTION';receipt.phase=connectionPhase.value;save();
  const client=await openConnection(rawDatabase,'quantos-f09-ledger-check',{record:receipt.bootstrapConnection,phase:connectionPhase,save});
  try {
    connectionPhase.value='MIGRATION_LEDGER';receipt.phase=connectionPhase.value;save();
    const remote = (await client.query(`select filename, sha256 from quantos.schema_migrations
      order by filename`)).rows;
    const migrationDir = path.join(root, 'supabase/migrations');
    const local = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
    receipt.migrationHead = validateF09MigrationLedger(remote, new Map(local.map(name => [name, fs.readFileSync(path.join(migrationDir, name))])));
  } finally {
    await client.end();
  }
  checkpoint('same source migration ledger and checksums');
  await run('cargo', ['build', '-p', 'capacity-monitor', '--locked']);
  await run('cargo', ['build', '-p', 'portfolio-rebuild', '--locked']);
  await run('node', ['scripts/f09-scheduler-smoke.cjs'], 'scheduler-smoke.log');
  checkpoint('two one-minute Supabase scheduler ticks fail closed on missing metrics');
  await run('make', ['test-f09-live'], 'postgres-exercises.log');
  checkpoint('live capacity, own-session termination, consumer recovery and redaction tests');
  await run('cargo', [
    'test', '-p', 'quantos-portfolio', '--test', 'postgres_portfolio', '--locked',
    'f09_portfolio_and_risk_queries_persist_actual_latency_samples', '--', '--exact', '--nocapture',
  ], 'portfolio-query.log');
  checkpoint('real portfolio and risk query samples');
  const liveEnv = { ...process.env, QUANTOS_RUN_F09_POSTGRES_TESTS: '1' };
  const bffOutput = await run('cargo', [
    'test', '-p', 'bff-gateway', '--lib', 'f09_live_tests', '--locked',
    '--', '--ignored', '--test-threads=1', '--nocapture',
  ], 'bff-write-trace.log', liveEnv);
  const runtimeOutput = await run('cargo', [
    'test', '-p', 'runtime-gateway', '--bin', 'runtime-gateway',
    'f09_runtime_real_write_trace', '--locked', '--', '--nocapture',
  ], 'runtime-write-trace.log', liveEnv);
  const portfolioOutput = await run('node', [
    'scripts/f09-portfolio-write-trace.cjs',
  ], 'portfolio-write-trace.log');
  const portfolioEvidence = portfolioOutput.split('\n')
    .filter((line) => line.includes('F09_PORTFOLIO_WRITE_TRACE_PASS'))
    .map((line) => JSON.parse(line)).at(-1);
  if (!portfolioEvidence || !portfolioEvidence.snapshotHash ||
      portfolioEvidence.lastEventSequence < 20 || portfolioEvidence.positionCount < 1) {
    throw new Error('F09 portfolio write trace evidence is incomplete');
  }
  receipt.writeTraces = {
    bffSessionRevoke: traceId(bffOutput, /F09 BFF real session revoke and persistent trace share correlation_id=([0-9a-f-]{36})/),
    runtimeRunSchedule: traceId(runtimeOutput, /F09 Runtime persisted run and trace share correlation_id=([0-9a-f-]{36})/),
    portfolioProjection: portfolioEvidence,
  };
  checkpoint('real BFF, Runtime and Portfolio writes linked to persistent trace');
  await run('cargo', [
    'test', '-p', 'quantos-engine-manager', '--test', 'python_mock_engine', '--locked',
    'manager_supervises_three_real_crashes_without_test_owned_restarts', '--', '--exact', '--nocapture',
  ], 'engine-crash.log');
  checkpoint('local supervised Engine process crash and recovery');
  receipt.status = 'PASS';receipt.phase='COMPLETE';
}

main().catch((error)=>{receipt.status='FAIL';receipt.failure={phase:receipt.phase||connectionPhase.value,code:error.code||'F09_TARGET_FAILED'};process.exitCode=1;console.error(receipt.failure.code);}).finally(async()=>{
 try{
  const fixtures=fs.existsSync(fixtureManifest)?fs.readFileSync(fixtureManifest,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  receipt.fixtureCleanup=await retireF09Fixtures(fixtures,fixtureRun,{databaseUrl:process.env.DATABASE_URL});
  const cleanupName='capacity-fixture-cleanup-'+fixtureRun+'.json',bytes=JSON.stringify(receipt.fixtureCleanup,null,2)+'\n';fs.writeFileSync(path.join(root,'artifacts/f09',cleanupName),bytes);receipt.logs??={};receipt.logs[cleanupName]=crypto.createHash('sha256').update(bytes).digest('hex');
  if(fs.existsSync(fixtureManifest))receipt.logs[fixtureName]=crypto.createHash('sha256').update(fs.readFileSync(fixtureManifest)).digest('hex');
  if(receipt.status==='PASS')validateF09Cleanup(receipt.fixtureCleanup);
  else if(receipt.fixtureCleanup.status==='FAIL')throw Error('F09_FIXTURE_CLEANUP_FAILED');
 }catch(error){receipt.status='FAIL';receipt.cleanupFailure={code:error.code||'F09_FIXTURE_CLEANUP_FAILED'};process.exitCode=1;}
 receipt.completedAt=new Date().toISOString();save();process.removeListener('SIGTERM',terminate);process.removeListener('SIGINT',terminate);
});
