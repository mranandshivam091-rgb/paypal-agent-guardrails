import { useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:4000'

function RulesPanel() {
  const [rules, setRules] = useState(null)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/rules`).then((r) => r.json()).then(setRules)
  }, [])

  if (!rules) return <p>Loading rules…</p>

  const save = async (e) => {
    e.preventDefault()
    const res = await fetch(`${API_BASE}/api/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    })
    setRules(await res.json())
    setSavedAt(new Date().toLocaleTimeString())
  }

  return (
    <form className="panel" onSubmit={save}>
      <h2>Spending Rules</h2>
      <label>
        Max per transaction ($)
        <input
          type="number"
          value={rules.max_transaction_amount}
          onChange={(e) => setRules({ ...rules, max_transaction_amount: e.target.value })}
        />
      </label>
      <label>
        Daily limit ($)
        <input
          type="number"
          value={rules.daily_limit}
          onChange={(e) => setRules({ ...rules, daily_limit: e.target.value })}
        />
      </label>
      <label>
        Allowed categories (comma-separated, blank = any)
        <input
          type="text"
          value={rules.allowed_categories}
          onChange={(e) => setRules({ ...rules, allowed_categories: e.target.value })}
        />
      </label>
      <label>
        Blocked categories (comma-separated)
        <input
          type="text"
          value={rules.blocked_categories}
          onChange={(e) => setRules({ ...rules, blocked_categories: e.target.value })}
        />
      </label>
      <button type="submit">Save rules</button>
      {savedAt && <span className="hint">Saved {savedAt}</span>}
    </form>
  )
}

function PurchaseSimulator({ onResult }) {
  const [amount, setAmount] = useState('20')
  const [category, setCategory] = useState('software')
  const [reasoning, setReasoning] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/agent/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), category, reasoning }),
      })
      const transaction = await res.json()
      onResult(transaction)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Simulate Agent Purchase</h2>
      <p className="hint">Stands in for an AI agent proposing a purchase, for demo purposes.</p>
      <label>
        Amount ($)
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Category
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <label>
        Agent's reasoning
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Why the agent wants to make this purchase"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Propose purchase'}
      </button>
    </form>
  )
}

function statusClass(status) {
  if (status === 'approved') return 'status approved'
  if (status === 'blocked') return 'status blocked'
  return 'status error'
}

function AuditLog({ transactions, refresh }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Audit Log</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Reasoning</th>
            <th>Rule check</th>
            <th>Risk</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{t.created_at}</td>
              <td>${t.amount}</td>
              <td>{t.category}</td>
              <td>{t.agent_reasoning}</td>
              <td>{t.rule_check_result}</td>
              <td>{t.risk_score}</td>
              <td><span className={statusClass(t.status)}>{t.status}</span></td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr><td colSpan={7}>No transactions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [transactions, setTransactions] = useState([])

  const refresh = () => {
    fetch(`${API_BASE}/api/transactions`).then((r) => r.json()).then(setTransactions)
  }

  useEffect(refresh, [])

  return (
    <div className="app">
      <header>
        <h1>PayPal Agent Guardrails</h1>
        <p>Spending control and audit layer for AI agents.</p>
      </header>
      <main>
        <div className="column">
          <RulesPanel />
          <PurchaseSimulator onResult={refresh} />
        </div>
        <div className="column wide">
          <AuditLog transactions={transactions} refresh={refresh} />
        </div>
      </main>
    </div>
  )
}

export default App
