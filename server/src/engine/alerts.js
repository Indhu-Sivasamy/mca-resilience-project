const ORDER = { High: 1, Critical: 2 };

// Returns the highest alert rule (High or Critical) whose threshold the score has reached, or null.
function alertRuleFor(score, rules) {
  let best = null;
  for (const rule of rules) {
    if (!ORDER[rule.level]) continue;
    if (score >= rule.threshold && (!best || ORDER[rule.level] > ORDER[best.level])) best = rule;
  }
  return best;
}

// An alert is raised when a region reaches a higher alert level than it had in the previous run.
function shouldAlert(currentRule, previousRule) {
  if (!currentRule) return false;
  if (!previousRule) return true;
  return ORDER[currentRule.level] > ORDER[previousRule.level];
}

module.exports = { alertRuleFor, shouldAlert, ORDER };
