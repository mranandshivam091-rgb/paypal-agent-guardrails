require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./db');
const { createOrder, captureOrder } = require('./services/paypal');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/test-order', async (req, res) => {
  try {
    const order = await createOrder(5, 'PayPal Agent Guardrails test order');
    const capture = await captureOrder(order.id);
    res.json({ order, capture });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
