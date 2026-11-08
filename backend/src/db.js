const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'guardrails.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT,
    agent_reasoning TEXT,
    rule_check_result TEXT,
    risk_score REAL,
    risk_explanation TEXT,
    status TEXT,
    paypal_order_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    max_transaction_amount REAL NOT NULL DEFAULT 100,
    daily_limit REAL NOT NULL DEFAULT 500,
    allowed_categories TEXT NOT NULL DEFAULT '',
    blocked_categories TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO rules (id) VALUES (1);
`);

module.exports = db;
