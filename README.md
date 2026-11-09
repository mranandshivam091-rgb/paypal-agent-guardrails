# PayPal Agent Guardrails

*Independent hackathon project for the PayPal AI Hackathon — not an official PayPal product.*

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

A user sets spending rules — a "confirm above" threshold and a list of categories that always need
a second look. When an AI agent wants to make a purchase, it calls this system's API instead of
PayPal directly. The system checks the purchase against the rules, has Gemini generate the agent's
justification and a context-aware risk score, and decides what happens next — see Two-outcome
decision flow below. Every decision is logged with full reasoning in a live audit dashboard, so a
human never has to be in the loop for each transaction but can always see exactly what happened and
why — and can step in directly when the system asks them to.

### Two-outcome decision flow

There is no auto-reject tier. The system never rejects a purchase on its own — it can only
auto-approve or pause and ask a human. Every proposed purchase lands in one of two states:

1. **Auto-approved** — below the `confirm_above_amount` threshold and not in a flagged category.
   PayPal order created immediately, no human involved.
2. **Flagged for human confirmation** — at or above the threshold (no matter how large — there is
   no upper ceiling) or in a flagged category. It's logged as `pending_confirmation` with no
   PayPal order yet, and shows up in the dashboard with an amber "needs review" badge. A human
   expands the row and clicks **Approve** (creates the real PayPal order now) or **Reject** (sets
   it to `blocked`, no order ever created).

`blocked` is a real status, but the system itself never assigns it — it only ever happens when a
human explicitly clicks Reject on a pending purchase. No legitimate transaction is ever silently
dropped by a rigid ceiling: every dollar either moves immediately or waits for a quick human
decision.

One more thing worth knowing: Gemini's risk score isn't just a function of the dollar amount — it
reacts to the actual content of the agent's stated reasoning. In testing, two $60 purchases against
the same rules scored very differently: one with ordinary reasoning scored risk **15**, while one
whose reasoning literally said *"Testing the reject path"* scored risk **75**, with Gemini's own
explanation flagging the phrasing itself as "potentially erratic or probing behavior." Same amount,
same rules — the score moved because the content did.

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
   ├─▶ Rules engine (guardrails.js)        deterministic two-way decision: approved /
   │                                        pending_confirmation — never auto-blocked (see above)
   │
   ├─▶ Gemini (services/ai.js)             generates reasoning (if omitted) + context-aware
   │                                        risk score, using the rule-check result and the
   │                                        last 5 transactions
   │
   ├─▶ PayPal Sandbox Orders API           called immediately if auto-approved; called later,
   │   (services/paypal.js)                 from a human Approve click, if pending_confirmation
   │
   └─▶ SQLite (db.js)                      every decision logged: amount, category, reasoning,
                                            rule check result, risk score, status, PayPal order ID

React dashboard (AG Grid) ── polls GET /api/transactions every 5s ──▶ live audit log
                                   │
                                   └─▶ pending_confirmation rows get Approve/Reject buttons,
                                       calling POST /api/transactions/:id/approve or /reject
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
cp .env.example .env   # fill in PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, GEMINI_API_KEY, DEMO_API_KEY
npm run dev
```
Runs on `http://localhost:4000`. `DEMO_API_KEY` can be any string you pick — it just needs to
match `VITE_DEMO_KEY` on the frontend (see below).

**Frontend** (separate terminal):
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000; set VITE_DEMO_KEY to match the backend's DEMO_API_KEY
npm run dev
```
Runs on `http://localhost:5173`.

### API reference

Write endpoints (marked 🔒) require an `X-Demo-Key` header matching `DEMO_API_KEY` — this is a
lightweight gate so a public demo link can't be used to alter or wipe the audit trail judges are
viewing. The frontend sends it automatically via `VITE_DEMO_KEY`. Read endpoints are open.

- `GET /api/health` — health check
- `GET /api/rules` — view the active spending rules
- 🔒 `PUT /api/rules` — edit the active spending rules
- `GET /api/transactions` — the audit log
- 🔒 `POST /api/agent/purchase` — the agent-facing endpoint: `{ amount, category, reasoning? }`
  (`amount` must be a positive number, `category` a non-empty string — otherwise 400). Runs the
  rule check, generates reasoning via Gemini if omitted, scores risk via Gemini, and creates a
  PayPal order immediately only if auto-approved.
- 🔒 `POST /api/transactions/:id/approve` — approves a `pending_confirmation` transaction, creating
  the real PayPal order and flipping its status to `approved`.
- 🔒 `POST /api/transactions/:id/reject` — rejects a `pending_confirmation` transaction, flipping
  its status to `blocked` with no PayPal order.
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
