import { useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import './App.css'

ModuleRegistry.registerModules([AllCommunityModule])

const gridTheme = themeQuartz.withParams({
  accentColor: '#0070E0',
  backgroundColor: '#FFFFFF',
  foregroundColor: '#1A1A1A',
  headerBackgroundColor: '#F7F9FA',
  headerTextColor: '#003087',
  headerFontWeight: 700,
  borderColor: '#E5E8EB',
  rowHoverColor: '#F0F6FF',
  borderRadius: 10,
  wrapperBorderRadius: 14,
  fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
})

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const REFRESH_INTERVAL_MS = 5000

function RulesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}

function LogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  )
}

function PanelTitle({ icon, children }) {
  return (
    <div className="panel-title">
      <span className="icon-chip">{icon}</span>
      <h2>{children}</h2>
    </div>
  )
}

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
      <PanelTitle icon={<RulesIcon />}>Spending Rules</PanelTitle>
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
      <button type="submit" className="btn-primary">Save rules</button>
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
      <PanelTitle icon={<BoltIcon />}>Simulate Agent Purchase</PanelTitle>
      <p className="hint hint-block">
        Stands in for an AI agent proposing a purchase, for demo purposes.
      </p>
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
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Propose purchase'}
      </button>
    </form>
  )
}

function statusBucket(status) {
  if (status === 'approved') return 'approved'
  if (status === 'blocked') return 'blocked'
  return 'pending'
}

function StatusBadgeRenderer({ value }) {
  const bucket = statusBucket(value)
  const icon = bucket === 'approved' ? <CheckIcon /> : bucket === 'blocked' ? <XIcon /> : <ClockIcon />
  return (
    <span className={`badge badge-${bucket}`}>
      {icon} {value}
    </span>
  )
}

function ChevronCell({ data }) {
  return (
    <span className={`expand-chevron${data._expanded ? ' expanded' : ''}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </span>
  )
}

function DetailField({ label, children }) {
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children}</div>
    </div>
  )
}

// Community-edition-compatible row expansion: AG Grid's built-in masterDetail feature is
// Enterprise-only (requires a license, shows a watermark without one — not viable for a public
// demo). This uses isFullWidthRow + fullWidthCellRenderer instead, which are Community features:
// expanding a row injects a synthetic full-width "detail" row right after it in rowData.
function DetailRowRenderer({ data }) {
  const t = data.parent
  return (
    <div className="detail-panel">
      <DetailField label="Agent reasoning">{t.agent_reasoning || '—'}</DetailField>
      <DetailField label="Rule check result">{t.rule_check_result || '—'}</DetailField>
      <DetailField label="Risk notes">{t.risk_explanation || '—'}</DetailField>
      <DetailField label="PayPal order ID">{t.paypal_order_id || '—'}</DetailField>
    </div>
  )
}

function AuditLog({ transactions, refresh }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rowData = useMemo(() => {
    const rows = []
    for (const t of transactions) {
      const expanded = expandedIds.has(t.id)
      rows.push({ ...t, _detail: false, _expanded: expanded })
      if (expanded) {
        rows.push({ id: `detail-${t.id}`, _detail: true, parent: t })
      }
    }
    return rows
  }, [transactions, expandedIds])

  const columnDefs = useMemo(
    () => [
      { headerName: '', field: '_expand', width: 44, minWidth: 44, flex: 0, resizable: false, sortable: false, cellRenderer: ChevronCell },
      { headerName: 'Time', field: 'created_at', width: 150, minWidth: 140, flex: 0 },
      { headerName: 'Amount', field: 'amount', width: 90, minWidth: 80, flex: 0, valueFormatter: (p) => `$${p.value}` },
      { headerName: 'Category', field: 'category', flex: 1, minWidth: 110 },
      { headerName: 'Status', field: 'status', width: 130, minWidth: 120, flex: 0, cellRenderer: StatusBadgeRenderer },
      { headerName: 'Risk', field: 'risk_score', width: 80, minWidth: 70, flex: 0 },
    ],
    []
  )

  const defaultColDef = useMemo(
    () => ({ resizable: true, sortable: true }),
    []
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <PanelTitle icon={<LogIcon />}>Audit Log</PanelTitle>
        <button type="button" className="btn-secondary" onClick={refresh}>Refresh</button>
      </div>
      <div className="grid-wrap">
        <AgGridReact
          theme={gridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          isFullWidthRow={(params) => params.rowNode.data._detail}
          fullWidthCellRenderer={DetailRowRenderer}
          getRowHeight={(params) => (params.data._detail ? 320 : 44)}
          onRowClicked={(e) => {
            if (!e.data._detail) toggleExpand(e.data.id)
          }}
          domLayout="normal"
          suppressCellFocus
          overlayNoRowsTemplate="<span class='grid-empty-state'>No transactions yet — simulate a purchase to see it here.</span>"
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
      <header className="topbar">
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
