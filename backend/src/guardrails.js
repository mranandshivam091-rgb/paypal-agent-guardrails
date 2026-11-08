function parseCategoryList(text) {
  return text
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Deterministic rule check: amount/category limits only. Risk scoring is handled separately
// by the AI risk-assessment service (services/ai.js), which has context this function doesn't.
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

  const allowed = violations.length === 0;
  const ruleCheckResult = allowed ? 'passed' : violations.join('; ');

  return { allowed, ruleCheckResult };
}

module.exports = { evaluateTransaction };
