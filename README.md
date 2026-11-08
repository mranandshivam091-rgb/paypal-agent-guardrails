# PayPal Agent Guardrails

An AI-governed spending control and audit layer that sits between AI agents and PayPal payments.

As AI agents increasingly get access to real payment methods, there's no way for a user to set
boundaries on what an agent can spend, or to audit *why* it made a given purchase. This project
provides both:

- **Rules** — a user defines what an AI agent is allowed to buy (e.g. category limits, per-transaction
  caps, spending velocity limits).
- **Audit log** — every agent-initiated transaction is recorded with the agent's stated reasoning,
  the result of the rule check, a computed risk score, and the final PayPal order/capture status.

The goal is to let a human stay in control of agent-initiated spending without being in the loop for
every single transaction.

## Structure

- `backend/` — Node.js + Express API. Handles rule checks, risk scoring, the transaction audit log
  (SQLite), and PayPal sandbox order creation/capture via the Orders v2 API.
- `frontend/` — React + Vite app (scaffold only for now; UI not yet built).

## Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in PayPal sandbox credentials
npm run dev
```

- `GET /api/health` — health check
- `POST /api/test-order` — creates and captures a hardcoded $5 PayPal sandbox order, to verify the
  PayPal connection end to end

## License

MIT, see [LICENSE](LICENSE).
