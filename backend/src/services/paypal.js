const paypal = require('@paypal/checkout-server-sdk');

const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

async function createOrder(amount, description) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        description,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
      },
    ],
  });

  const response = await client.execute(request);
  return response.result;
}

async function captureOrder(orderId) {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  const response = await client.execute(request);
  return response.result;
}

// Sandbox test card — pays and captures in one call, no buyer-approval redirect needed.
// https://developer.paypal.com/tools/sandbox/card-testing/
async function createOrderWithTestCard(amount, description) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.headers['PayPal-Request-Id'] = `guardrails-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        description,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
      },
    ],
    payment_source: {
      card: {
        number: '4032039906055165',
        expiry: '2027-12',
        security_code: '123',
        name: 'Guardrails Test Buyer',
      },
    },
  });

  const response = await client.execute(request);
  return response.result;
}

module.exports = { createOrder, captureOrder, createOrderWithTestCard };
