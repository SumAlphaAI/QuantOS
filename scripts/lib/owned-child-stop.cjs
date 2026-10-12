// Only stop the ChildProcess owned by this probe. A signal exit has no exitCode.
async function stopOwnedChild(child, { graceMs = 3000, killMs = 3000 } = {}) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  await new Promise((resolve, reject) => {
    let grace, limit;
    const finish = error => { clearTimeout(grace); clearTimeout(limit); child.off('exit', exited);
      error ? reject(error) : resolve(); };
    const exited = () => finish();
    child.once('exit', exited);
    grace = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { finish(Object.assign(Error('owned scheduler kill failed'), { code: 'CHILD_STOP_FAILED' })); }
    }, graceMs);
    limit = setTimeout(() => finish(Object.assign(Error('owned scheduler did not stop'), { code: 'CHILD_STOP_TIMEOUT' })), graceMs + killMs);
    try { child.kill('SIGTERM'); } catch { finish(Object.assign(Error('owned scheduler stop failed'), { code: 'CHILD_STOP_FAILED' })); }
  });
}
module.exports = { stopOwnedChild };
