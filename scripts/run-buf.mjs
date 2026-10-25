import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

function execute(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['inherit', 'pipe', 'pipe']});
    let stderr = '';
    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => {
      process.stderr.write(chunk);
      stderr = (stderr + chunk.toString()).slice(-32_768);
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({code, signal, stderr}));
  });
}

// Retry only explicit transport statuses. Lint, schema, generation and
// compatibility errors still fail immediately; exhausted retries also fail.
export async function runBuf(command, args, options = {}) {
  const run = options.execute ?? execute;
  const sleep = options.delay ?? delay;
  const log = options.log ?? console.error;
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`Buf ${args[0]}: attempt ${attempt}/3`);
    const result = await run(command, args);
    if (result.code === 0) return 0;
    const transient = /^Failure: (?:deadline_exceeded|unavailable):/m.test(result.stderr);
    if (result.signal || !transient || attempt === 3) return result.code || 1;
    log(`Buf transport failure; retrying ${args[0]} after ${attempt}s`);
    await sleep(attempt * 1000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (!command || args.length === 0) throw new Error('Usage: run-buf.mjs <buf executable> <arguments...>');
  process.exitCode = await runBuf(command, args);
}
