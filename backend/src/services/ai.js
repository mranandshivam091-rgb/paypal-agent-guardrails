const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// gemini-2.0-flash and gemini-2.5-flash are both retired/unavailable to new API keys as of
// Nov 2026 — gemini-3.8-flash is the current flash model, but being new it's prone to
// transient 503 "high demand" errors, hence the retry below.
const MODEL = 'gemini-3.8-flash';

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

async function generateContentWithRetry(model, prompt, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const isOverloaded = err.status === 503;
      if (!isOverloaded || i === attempts - 1) throw err;
      console.log(`Gemini overloaded (attempt ${i + 1}/${attempts}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

// Static fallback for when Gemini is unreachable even after retries — used so a purchase
// decision never depends on the AI service being up.
const FALLBACK_REASONING = 'Reasoning unavailable (AI service timeout).';

// Derives a risk score from the deterministic rule-check result alone, for use when the AI
// risk assessment couldn't be obtained (service down, or returned unparseable output).
function fallbackRiskFromRuleCheck(ruleCheckResult) {
  if (ruleCheckResult === 'passed') {
    return { riskScore: 20, explanation: 'AI risk assessment unavailable; defaulted to low risk because the rule check passed.' };
  }
  const violationCount = ruleCheckResult.split(';').filter(Boolean).length;
  const riskScore = Math.min(100, 50 + violationCount * 15);
  return {
    riskScore,
    explanation: `AI risk assessment unavailable; defaulted to elevated risk based on ${violationCount} rule violation(s).`,
  };
}

// Has the agent explain, in its own voice, why it wants to make this purchase.
async function generateAgentReasoning(item, amount, category) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction:
      "You are an AI shopping agent that just decided to make a purchase on behalf of the user whose account you manage. Write a short, realistic, first-person justification (2-3 sentences) explaining why you're making this purchase, as if explaining your decision to the user. Be concrete and natural, not robotic. Respond with only the justification text, nothing else.",
  });

  try {
    const result = await generateContentWithRetry(
      model,
      `Item: ${item}\nAmount: $${amount}\nCategory: ${category}`
    );
    return result.response.text().trim();
  } catch (err) {
    console.warn('generateAgentReasoning: Gemini call failed after retries, falling back:', err.message);
    return FALLBACK_REASONING;
  }
}

// Scores the risk of a proposed purchase using the rule-check result and recent transaction
// history as context, instead of a static formula. Falls back to a rule-check-severity-based
// score if Gemini is unreachable or returns unparseable output.
async function assessRisk(amount, category, reasoning, ruleCheckResult, recentTransactions) {
  const history = recentTransactions.length
    ? recentTransactions
        .map(
          (t) =>
            `- $${t.amount} / ${t.category} / ${t.status} / risk ${t.risk_score} / reasoning: ${t.agent_reasoning || '(none)'}`
        )
        .join('\n')
    : '(no prior transactions)';

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction:
      'You are the risk-assessment engine for an AI agent spending guardrail system. Given a proposed purchase, the deterministic rule-check result, and recent transaction history, score how risky this purchase is from 0 (no risk) to 100 (very risky). Weigh the quality of the agent\'s reasoning, whether it passed the rule check, and whether recent history shows concerning patterns (e.g. repeated or escalating purchases, vague reasoning). Respond with ONLY valid JSON, no markdown fences, no extra text, in exactly this shape: {"risk_score": <integer 0-100>, "explanation": "<one sentence>"}',
    generationConfig: { responseMimeType: 'application/json' },
  });

  let result;
  try {
    result = await generateContentWithRetry(
      model,
      `Amount: $${amount}\nCategory: ${category}\nAgent's reasoning: ${reasoning}\nRule check result: ${ruleCheckResult}\n\nRecent transactions (most recent first):\n${history}`
    );
  } catch (err) {
    console.warn('assessRisk: Gemini call failed after retries, falling back to rule-check severity:', err.message);
    return fallbackRiskFromRuleCheck(ruleCheckResult);
  }

  try {
    const parsed = JSON.parse(stripCodeFences(result.response.text()));
    return {
      riskScore: Math.max(0, Math.min(100, Math.round(Number(parsed.risk_score)))),
      explanation: String(parsed.explanation || ''),
    };
  } catch (err) {
    console.warn('assessRisk: could not parse Gemini response, falling back to rule-check severity:', err.message);
    return fallbackRiskFromRuleCheck(ruleCheckResult);
  }
}

module.exports = { generateAgentReasoning, assessRisk };
