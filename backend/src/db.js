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
    flagged_categories TEXT NOT NULL DEFAULT '',
    confirm_above_amount REAL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO rules (id) VALUES (1);
`);

// Migrate installs created before the hard-block tier was removed: the old rules table had
// max_transaction_amount/daily_limit/allowed_categories/blocked_categories columns instead of
// flagged_categories. CREATE TABLE IF NOT EXISTS above is a no-op on an existing table, so add
// the new column by hand and carry over blocked_categories as the starting flagged list.
const ruleColumns = db.prepare("PRAGMA table_info(rules)").all().map((c) => c.name);
if (!ruleColumns.includes('flagged_categories')) {
  db.exec("ALTER TABLE rules ADD COLUMN flagged_categories TEXT NOT NULL DEFAULT ''");
  if (ruleColumns.includes('blocked_categories')) {
    db.exec('UPDATE rules SET flagged_categories = blocked_categories');
  }
}

module.exports = db;
