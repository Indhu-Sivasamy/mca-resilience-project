const test = require('node:test');
const assert = require('node:assert');
const { alertRuleFor, shouldAlert } = require('../src/engine/alerts');

const rules = [
  { level: 'Critical', threshold: 0.75, action_text: 'a' },
  { level: 'High', threshold: 0.5, action_text: 'b' },
  { level: 'Medium', threshold: 0.25, action_text: 'c' },
];

test('picks the highest rule reached and ignores Medium', () => {
  assert.strictEqual(alertRuleFor(0.9, rules).level, 'Critical');
  assert.strictEqual(alertRuleFor(0.6, rules).level, 'High');
  assert.strictEqual(alertRuleFor(0.3, rules), null);
});

test('alerts only when the level gets worse', () => {
  const high = alertRuleFor(0.6, rules);
  const critical = alertRuleFor(0.9, rules);
  assert.strictEqual(shouldAlert(high, null), true);
  assert.strictEqual(shouldAlert(critical, high), true);
  assert.strictEqual(shouldAlert(high, high), false);
  assert.strictEqual(shouldAlert(high, critical), false);
  assert.strictEqual(shouldAlert(null, high), false);
});
