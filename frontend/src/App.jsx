import { useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from 'ag-grid-community'
import './App.css'

ModuleRegistry.registerModules([AllCommunityModule])

const gridTheme = themeQuartz.withPart(colorSchemeDark)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const REFRESH_INTERVAL_MS = 5000

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
        Agent's reasoning (optional — leave blank to let AI generate the agent's reasoning)
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

const statusCellClassRules = {
  'status-cell-approved': (params) => params.value === 'approved',
  'status-cell-blocked': (params) => params.value === 'blocked',
  'status-cell-pending': (params) => params.value !== 'approved' && params.value !== 'blocked',
}

function AuditLog({ transactions, refresh }) {
  const columnDefs = useMemo(
    () => [
      { headerName: 'Time', field: 'created_at', minWidth: 160 },
      { headerName: 'Amount', field: 'amount', minWidth: 100, valueFormatter: (p) => `$${p.value}` },
      { headerName: 'Category', field: 'category', minWidth: 120 },
      { headerName: 'Status', field: 'status', minWidth: 110, cellClassRules: statusCellClassRules },
      { headerName: 'Risk', field: 'risk_score', minWidth: 90 },
      { headerName: 'Agent reasoning', field: 'agent_reasoning', flex: 2, minWidth: 220, wrapText: true, autoHeight: true },
      { headerName: 'Rule check result', field: 'rule_check_result', flex: 1.5, minWidth: 180, wrapText: true, autoHeight: true },
      { headerName: 'Risk notes', field: 'risk_explanation', flex: 1.5, minWidth: 180, wrapText: true, autoHeight: true },
      { headerName: 'PayPal order ID', field: 'paypal_order_id', minWidth: 160 },
    ],
    []
  )

  const defaultColDef = useMemo(
    () => ({ flex: 1, minWidth: 100, resizable: true, sortable: true }),
    []
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Audit Log</h2>
        <button type="button" onClick={refresh}>Refresh</button>
      </div>
      <div className="grid-wrap">
        <AgGridReact
          theme={gridTheme}
          rowData={transactions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          domLayout="normal"
          suppressCellFocus
        />
      </div>
    </div>
  )
}

function App() {
  const [transactions, setTransactions] = useState([])

  const refresh = () => {
    fetch(`${API_BASE}/api/transactions`).then((r) => r.json()).then(setTransactions)
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

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
