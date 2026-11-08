function parseCategoryList(text) {
  return text
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Checks a proposed transaction against the active rules and scores its risk 0-100 (higher = riskier).
function evaluateTransaction({ amount, category, reasoning }, rules, todaySpend) {
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

  let riskScore = Math.min(50, (amount / rules.max_transaction_amount) * 50);
  riskScore += violations.length * 20;
  if (!reasoning || reasoning.trim().length < 10) riskScore += 15;
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  return { allowed, ruleCheckResult, riskScore };
}

module.exports = { evaluateTransaction };
