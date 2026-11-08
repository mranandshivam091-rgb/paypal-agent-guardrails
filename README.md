# PayPal Agent Guardrails

An AI-governed spending control and audit layer that sits between AI agents and PayPal payments.

As AI agents increasingly get access to real payment methods, there's no way for a user to set
boundaries on what an agent can spend, or to audit *why* it made a given purchase. This project
provides both:

- **Rules** — a user defines what an AI agent is allowed to buy (e.g. category limits, per-transaction
  caps, spending velocity limits).
- **Audit log** — every agent-initiated transaction is recorded with the agent's stated reasoning,
  the result of the rule check, a risk score with a one-sentence explanation, and the final PayPal
  order/capture status.

The goal is to let a human stay in control of agent-initiated spending without being in the loop for
every single transaction.

## Tools used

- **PayPal Orders v2 API (sandbox)** — creates and captures the actual payment once a purchase is
  approved by the guardrail layer.
- **Google Gemini API** (`@google/generative-ai`, `gemini-3.5-flash-lite`) — does the actual AI work,
  not just the reasoning text:
  1. **Generating the agent's purchase justification** — when the simulated agent doesn't supply its
     own reasoning, Gemini writes a realistic first-person justification for the purchase
     (`backend/src/services/ai.js` → `generateAgentReasoning`).
  2. **Context-aware risk scoring** — risk is *not* a static formula. Gemini is given the proposed
     purchase, the deterministic rule-check result, and the last 5 transactions, and returns a
     0–100 risk score plus a one-sentence rationale, so it can catch patterns a fixed formula can't
     (e.g. vague reasoning, escalating purchase amounts, repeated near-limit transactions)
     (`backend/src/services/ai.js` → `assessRisk`).

  The amount/category/daily-limit rule check itself stays deterministic and rule-based
  (`backend/src/guardrails.js`) — that's a correctness-critical boundary that shouldn't depend on a
  model call.

## Structure

- `backend/` — Node.js + Express API. Handles rule checks, AI-driven reasoning + risk scoring, the
  transaction audit log (SQLite), and PayPal sandbox order creation/capture via the Orders v2 API.
- `frontend/` — React + Vite dashboard for editing rules, simulating agent purchases, and viewing
  the audit log.

## Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in PayPal sandbox credentials + GEMINI_API_KEY
npm run dev
```

- `GET /api/health` — health check
- `POST /api/test-order` — creates and captures a hardcoded $5 PayPal sandbox order, to verify the
  PayPal connection end to end
- `GET/PUT /api/rules` — view/edit the active spending rules
- `GET /api/transactions` — the audit log
- `POST /api/agent/purchase` — the agent-facing endpoint: `{ amount, category, reasoning? }`. Runs
  the rule check, generates reasoning via Gemini if omitted, scores risk via Gemini, and only
  creates a PayPal order if the rule check passes.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000, override if needed
npm run dev
```

`VITE_API_URL` is read at build time (Vite inlines env vars), so it must be set before `npm run
build` for a deployed build to point at the right backend — see Deploy below.

## Deploy

This repo includes a [`render.yaml`](render.yaml) that defines both services as a
[Render Blueprint](https://render.com/docs/blueprint-spec):

- `paypal-agent-guardrails-backend` — Node web service, built from `/backend`
- `paypal-agent-guardrails-frontend` — static site, built from `/frontend`

### Steps in the Render dashboard

1. Push this repo to GitHub (or GitLab), if it isn't already.
2. In the Render dashboard: **New** → **Blueprint**, connect the repo. Render detects
   `render.yaml` and proposes both services.
3. Before clicking **Apply**, Render will prompt for the env vars marked `sync: false` in
   `render.yaml`. Fill in:
   - **Backend** — `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (your PayPal sandbox app
     credentials), `GEMINI_API_KEY` (your Gemini API key)
   - **Frontend** — `VITE_API_URL`: leave this blank for now; you can't know the backend's
     final URL until after it's deployed (see step 5).
4. Click **Apply**. Render builds and deploys both services.
5. Once the backend service is live, copy its URL from the Render dashboard (something like
   `https://paypal-agent-guardrails-backend.onrender.com`).
6. Go to the frontend service → **Environment**, set `VITE_API_URL` to that backend URL, and
   trigger a manual redeploy (static sites bake env vars into the build, so changing the var
   requires a rebuild — just setting it isn't enough).
7. Visit the frontend's Render URL to confirm the dashboard loads and can reach the backend
   (e.g. the Rules panel should load the current rules instead of showing "Loading rules…"
   indefinitely).

Both services are on Render's free plan by default (`plan: free` in `render.yaml`) — free web
services spin down after inactivity and take ~30–60s to wake on the next request.

## License

MIT, see [LICENSE](LICENSE).
