# PayPal Agent Guardrails

An AI-governed spending control and audit layer that sits between AI agents and PayPal payments —
so a user can define exactly what an agent is allowed to buy, and see a full audit trail of every
agent-initiated transaction: the agent's reasoning, an AI-generated risk score, and whether PayPal
actually processed it.

## The problem

AI agents are starting to make purchases on their own. PayPal, along with Visa, Mastercard, and
Stripe, now all have some form of agent checkout. But the payment rail was never the hard part —
knowing an agent *can* pay is different from knowing it *should*, and from being able to explain
afterward why it did. Forrester draws this line explicitly: most of what's shipping today is just
"payments simply triggered by an AI assistant," not what they define as true agentic payments —
*"programmable, policy-governed payment flows in which AI agents act on behalf of businesses to
initiate, authorize, execute, and reconcile transactions."* ([Forrester, "B2B Will Be The Proving
Ground For Agentic Payments"](https://www.forrester.com/blogs/b2b-will-be-the-proving-ground-for-agentic-payments/))
The policy and accountability layer — the part that actually makes autonomous spending safe — is
still missing from most agent-payment integrations.

## What this does

A user sets spending rules (per-transaction cap, daily limit, allowed/blocked categories). When an
AI agent wants to make a purchase, it calls this system's API instead of PayPal directly. The
system checks the purchase against the rules, has Gemini generate the agent's justification and a
context-aware risk score, and only forwards the purchase to PayPal if it passes. Every decision —
approved or blocked — is logged with full reasoning in a live audit dashboard, so a human never has
to be in the loop for each transaction but can always see exactly what happened and why.

## Live demo

- Frontend (dashboard): **https://paypal-agent-guardrails-frontend.onrender.com**
- Backend (API): **https://paypal-agent-guardrails-backend.onrender.com**

Both run on Render's free tier. The backend spins down after inactivity — the **first** request
after a period of idleness can take **30–60 seconds** to wake up. If the dashboard seems stuck on
"Loading rules…", that's why; it'll resolve on its own.

## Architecture

```
AI agent
   │  POST /api/agent/purchase { amount, category, reasoning? }
   ▼
Express API (backend/src/index.js)
   │
   ├─▶ Rules engine (guardrails.js)        deterministic: amount/category/daily-limit check
   │
   ├─▶ Gemini (services/ai.js)             generates reasoning (if omitted) + context-aware
   │                                        risk score, using the rule-check result and the
   │                                        last 5 transactions
   │
   ├─▶ PayPal Sandbox Orders API           only called if the rule check passed
   │   (services/paypal.js)
   │
   └─▶ SQLite (db.js)                      every decision logged: amount, category, reasoning,
                                            rule check result, risk score, status, PayPal order ID

React dashboard (AG Grid) ── polls GET /api/transactions every 5s ──▶ live audit log
```

The rule check is deliberately kept deterministic and separate from the AI calls — a
correctness-critical boundary (how much an agent can spend) shouldn't depend on a model call
succeeding.

## Local setup

Requires Node.js. You'll need a PayPal sandbox app ([developer.paypal.com](https://developer.paypal.com))
and a free Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey) — no
billing required).

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # fill in PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, GEMINI_API_KEY
npm run dev
```
Runs on `http://localhost:4000`.

**Frontend** (separate terminal):
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000, override if needed
npm run dev
```
Runs on `http://localhost:5173`.

### API reference

- `GET /api/health` — health check
- `GET/PUT /api/rules` — view/edit the active spending rules
- `GET /api/transactions` — the audit log
- `POST /api/agent/purchase` — the agent-facing endpoint: `{ amount, category, reasoning? }`. Runs
  the rule check, generates reasoning via Gemini if omitted, scores risk via Gemini, and only
  creates a PayPal order if the rule check passes.
- `POST /api/test-order` — basic PayPal sandbox connectivity smoke test

## Tools used

- **[PayPal Developer Platform](https://developer.paypal.com)** (Sandbox Orders v2 API) — creates
  the actual payment order once a purchase is approved by the guardrail layer
  (`backend/src/services/paypal.js`).
- **[Google Gemini API](https://aistudio.google.com)** (`@google/generative-ai`,
  `gemini-3.5-flash-lite`) — does the AI work, not just the reasoning text:
  1. **Generates the agent's purchase justification** when the caller doesn't supply its own
     (`generateAgentReasoning`).
  2. **Context-aware risk scoring** — given the proposed purchase, the deterministic rule-check
     result, and the last 5 transactions, Gemini returns a 0–100 risk score plus a one-sentence
     rationale, catching patterns a static formula can't (vague reasoning, escalating amounts,
     repeated near-limit purchases) (`assessRisk`). Falls back to a rule-check-severity-based score
     if Gemini is unreachable, so a model hiccup never breaks a purchase decision.
- **[AG Grid](https://www.ag-grid.com/)** (`ag-grid-react`) — the live audit dashboard: sortable,
  resizable columns with color-coded status cells, auto-refreshing every 5 seconds.
- **React + Vite** — frontend dashboard.
- **Node.js + Express** — backend API.
- **SQLite** (`better-sqlite3`) — the `transactions` and `rules` tables; zero setup, file-based.
- **[Render](https://render.com)** — hosts both services (`render.yaml` Blueprint: Node web service
  + static site).

## License

MIT, see [LICENSE](LICENSE).
