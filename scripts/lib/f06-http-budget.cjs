// Transport patience for remote development probes, never a latency acceptance.
module.exports = function httpBudget(value = process.env.QUANTOS_F06_HTTP_TIMEOUT_MS) {
  if (value === undefined) return 15000;
  if (!/^\d+$/.test(value)) throw Error('F06 HTTP budget must be integer milliseconds');
  const ms = Number(value);
  if (ms < 15000 || ms > 60000) throw Error('F06 HTTP budget must be between 15000 and 60000');
  return ms;
};
