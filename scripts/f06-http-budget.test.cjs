const test = require('node:test');
const assert = require('node:assert/strict');
const budget = require('./lib/f06-http-budget.cjs');
test('default and bounded remote development transport budgets', () => {
  assert.equal(budget('15000'), 15000);
  assert.equal(budget('60000'), 60000);
});
test('unbounded, fractional and malformed budgets fail closed', () => {
  for (const value of ['0', '14999', '60001', 'Infinity', 'NaN', '15000.1', '', ' 15000'])
    assert.throws(() => budget(value));
});
