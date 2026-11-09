function parseCategoryList(text) {
  return text
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Deterministic rule check: amount/category limits only. Risk scoring is handled separately
// by the AI risk-assessment service (services/ai.js), which has context this function doesn't.
//
// Three-way decision instead of a simple allow/deny: a hard-rule violation (blocked category,
// over max_transaction_amount or daily_limit) is always 'blocked'. Within those hard limits, an
// amount over confirm_above_amount is 'pending_confirmation' — not auto-approved, but not
// rejected either, pending a human decision. Everything else is 'approved'.
function evaluateTransaction({ amount, category }, rules, todaySpend) {
  const allowedCategories = parseCategoryList(rules.allowed_categories);
  const blockedCategories = parseCategoryList(rules.blocked_categories);
  const normalizedCategory = (category || '').trim().toLowerCase();

  const violations = [];

  if (blockedCategories.includes(normalizedCategory)) {
    violations.push(`category '${category}' is blocked`);
  }
  if (allowedCategories.length > 0 && !allowedCategories.includes(normalizedCategory)) {
    violations.push(`category '${category}' is not in the allowed list`);
  }
  if (amount > rules.max_transaction_amount) {
    violations.push(`amount $${amount} exceeds max transaction limit of $${rules.max_transaction_amount}`);
  }
  if (todaySpend + amount > rules.daily_limit) {
    violations.push(
      `would exceed daily limit of $${rules.daily_limit} (already spent $${todaySpend} today)`
    );
  }

  if (violations.length > 0) {
    return { decision: 'blocked', ruleCheckResult: violations.join('; ') };
  }

  if (rules.confirm_above_amount != null && amount > rules.confirm_above_amount) {
    return {
      decision: 'pending_confirmation',
      ruleCheckResult: `passed hard limits; requires human confirmation (amount $${amount} exceeds confirm-above threshold of $${rules.confirm_above_amount})`,
    };
  }

  return { decision: 'approved', ruleCheckResult: 'passed' };
}

module.exports = { evaluateTransaction };
