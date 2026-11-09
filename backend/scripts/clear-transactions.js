// Wipes the transactions table for a clean demo. Terminal-only — not exposed via the API.
// Run with: npm run clear-transactions (from backend/)
const db = require('../src/db');

const result = db.prepare('DELETE FROM transactions').run();
db.prepare("DELETE FROM sqlite_sequence WHERE name = 'transactions'").run();

console.log(`Cleared ${result.changes} transaction(s). IDs will restart from 1.`);
