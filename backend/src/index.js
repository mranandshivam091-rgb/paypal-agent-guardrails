require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { createOrder, captureOrder, createOrderWithTestCard } = require('./services/paypal');
const { evaluateTransaction } = require('./guardrails');
const { generateAgentReasoning, assessRisk } = require('./services/ai');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Basic PayPal sandbox smoke test. Capture will fail with ORDER_NOT_APPROVED — that's expected,
// since a real capture needs buyer approval. It still proves the credentials/auth work.
app.post('/api/test-order', async (req, res) => {
  try {
    const order = await createOrder(5, 'PayPal Agent Guardrails test order');
    const capture = await captureOrder(order.id);
    res.json({ order, capture });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Full create+capture round trip using a PayPal sandbox test card (no buyer redirect needed).
app.post('/api/test-order-card', async (req, res) => {
  try {
    const order = await createOrderWithTestCard(5, 'PayPal Agent Guardrails test order (card)');
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM rules WHERE id = 1').get();
  res.json(rules);
});

app.put('/api/rules', (req, res) => {
  const { max_transaction_amount, daily_limit, allowed_categories, blocked_categories, confirm_above_amount } =
    req.body;
  db.prepare(
    `UPDATE rules SET
      max_transaction_amount = ?,
      daily_limit = ?,
      allowed_categories = ?,
      blocked_categories = ?,
      confirm_above_amount = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    Number(max_transaction_amount),
    Number(daily_limit),
    allowed_categories || '',
    blocked_categories || '',
    confirm_above_amount === '' || confirm_above_amount == null ? null : Number(confirm_above_amount)
  );
  const rules = db.prepare('SELECT * FROM rules WHERE id = 1').get();
  res.json(rules);
});

app.get('/api/transactions', (req, res) => {
  const transactions = db.prepare('SELECT * FROM transactions ORDER BY id DESC').all();
  res.json(transactions);
});

// The agent-facing endpoint: an AI agent proposes a purchase (optionally with its own reasoning
// — if omitted, Gemini generates it). The deterministic rule check runs first; Gemini then scores
// risk using that result plus recent transaction history. PayPal is only called immediately if
// the purchase is auto-approved — a 'blocked' or 'pending_confirmation' decision never reaches
// PayPal here (pending ones can still reach it later via the approve endpoint below).
app.post('/api/agent/purchase', async (req, res) => {
  try {
    const { amount, category } = req.body;
    let { reasoning } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const rules = db.prepare('SELECT * FROM rules WHERE id = 1').get();
    const todaySpend = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
         WHERE status = 'approved' AND date(created_at) = date('now')`
      )
      .get().total;

    const { decision, ruleCheckResult } = evaluateTransaction({ amount, category }, rules, todaySpend);

    if (!reasoning) {
      reasoning = await generateAgentReasoning(category || 'this item', amount, category);
    }

    const recentTransactions = db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 5').all();
    const { riskScore, explanation: riskExplanation } = await assessRisk(
      amount,
      category,
      reasoning,
      ruleCheckResult,
      recentTransactions
    );

    let status = decision;
    let paypalOrderId = null;

    if (decision === 'approved') {
      try {
        const order = await createOrder(amount, reasoning || category || 'Agent purchase');
        paypalOrderId = order.id;
      } catch (err) {
        status = 'error';
      }
    }

    const result = db
      .prepare(
        `INSERT INTO transactions
          (amount, category, agent_reasoning, rule_check_result, risk_score, risk_explanation, status, paypal_order_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(amount, category, reasoning, ruleCheckResult, riskScore, riskExplanation, status, paypalOrderId);

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    res.json(transaction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Human-in-the-loop decision on a pending_confirmation transaction. Approving creates the real
// PayPal order now (it was deliberately withheld at proposal time); rejecting just blocks it.
app.post('/api/transactions/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!transaction) return res.status(404).json({ error: 'transaction not found' });
    if (transaction.status !== 'pending_confirmation') {
      return res.status(400).json({ error: `transaction is not pending confirmation (status: ${transaction.status})` });
    }

    let status = 'approved';
    let paypalOrderId = null;
    try {
      const order = await createOrder(
        transaction.amount,
        transaction.agent_reasoning || transaction.category || 'Agent purchase'
      );
      paypalOrderId = order.id;
    } catch (err) {
      status = 'error';
    }

    db.prepare('UPDATE transactions SET status = ?, paypal_order_id = ? WHERE id = ?').run(status, paypalOrderId, id);
    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/:id/reject', (req, res) => {
  try {
    const id = Number(req.params.id);
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!transaction) return res.status(404).json({ error: 'transaction not found' });
    if (transaction.status !== 'pending_confirmation') {
      return res.status(400).json({ error: `transaction is not pending confirmation (status: ${transaction.status})` });
    }

    db.prepare("UPDATE transactions SET status = 'blocked' WHERE id = ?").run(id);
    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
