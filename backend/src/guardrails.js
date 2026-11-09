function parseCategoryList(text) {
  return text
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Deterministic rule check. There is no auto-reject tier: a purchase either auto-approves or
// pauses for a human to decide. 'blocked' only ever happens later, when a human clicks Reject on
// a pending transaction (see the /approve and /reject endpoints in index.js) — this function
// never returns it.
//
// A flagged category always routes to pending_confirmation, regardless of amount. Otherwise,
// amount >= confirm_above_amount (if set) routes to pending_confirmation, with no ceiling — any
// amount above the threshold waits for a human, it never gets auto-rejected. Everything else is
// 'approved'.
function evaluateTransaction({ amount, category }, rules) {
  const flaggedCategories = parseCategoryList(rules.flagged_categories);
  const normalizedCategory = (category || '').trim().toLowerCase();

  if (flaggedCategories.includes(normalizedCategory)) {
    return {
      decision: 'pending_confirmation',
      ruleCheckResult: `requires human confirmation: category '${category}' is flagged for review`,
    };
  }

  if (rules.confirm_above_amount != null && amount >= rules.confirm_above_amount) {
    return {
      decision: 'pending_confirmation',
      ruleCheckResult: `requires human confirmation: amount $${amount} meets or exceeds confirm-above threshold of $${rules.confirm_above_amount}`,
    };
  }

  return { decision: 'approved', ruleCheckResult: 'passed' };
}

module.exports = { evaluateTransaction };
