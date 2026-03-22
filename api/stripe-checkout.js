const Stripe = require('stripe');

const DEFAULT_PRICE_IDS = {
  trial: 'price_1TAHcARnukIXynrtXOTiILU7',
  monthly: 'price_1TAHcARnukIXynrtUdLwonZS',
};

const PLAN_CATALOG = {
  trial: {
    id: 'trial',
    mode: 'payment',
    priceId: getConfigValue('STRIPE_TRIAL_PRICE_ID', DEFAULT_PRICE_IDS.trial),
  },
  monthly: {
    id: 'monthly',
    mode: 'subscription',
    priceId: getConfigValue('STRIPE_MONTHLY_PRICE_ID', DEFAULT_PRICE_IDS.monthly),
  },
};

let stripeClient = null;

function getConfigValue(name, fallback = '') {
  return process.env[name] || process.env[name.toLowerCase()] || fallback;
}

function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = getConfigValue('STRIPE_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Missing Stripe secret key. Set STRIPE_SECRET_KEY or stripe_secret_key in .env.');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-09-30.clover',
  });
  return stripeClient;
}

function getPublishableKey() {
  const publishableKey = getConfigValue('STRIPE_PUBLISHABLE_KEY');
  if (!publishableKey) {
    throw new Error(
      'Missing Stripe publishable key. Set STRIPE_PUBLISHABLE_KEY or stripe_publishable_key in .env.',
    );
  }
  return publishableKey;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getPlan(planId) {
  return PLAN_CATALOG[planId] || null;
}

function getOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : (req.socket?.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host || 'localhost:3000'}`;
}

function getReturnUrl(req) {
  return `${getOrigin(req)}/?payment=success&session_id={CHECKOUT_SESSION_ID}#pricing`;
}

async function createCheckoutSession(body, req, res) {
  const planId = typeof body?.plan_id === 'string' ? body.plan_id.trim() : '';
  const plan = getPlan(planId);

  if (!plan) {
    sendJson(res, 400, { error: 'Unknown pricing option.' });
    return;
  }

  if (!plan.priceId) {
    sendJson(res, 500, { error: 'This pricing option is not configured in Stripe yet.' });
    return;
  }

  const stripe = getStripeClient();
  const customerEmail = typeof body?.customer_email === 'string' ? body.customer_email.trim() : '';
  const agentId = typeof body?.agent_id === 'string' ? body.agent_id.trim() : '';
  const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'custom',
    mode: plan.mode,
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    return_url: getReturnUrl(req),
    billing_address_collection: 'auto',
    payment_method_types: ['card'],
    customer_email: customerEmail || undefined,
    customer_creation: plan.mode === 'payment' ? 'always' : undefined,
    client_reference_id: agentId || userId || planId,
    metadata: {
      plan_id: planId,
      agent_id: agentId,
      user_id: userId,
    },
    subscription_data: plan.mode === 'subscription'
      ? {
          metadata: {
            plan_id: planId,
            agent_id: agentId,
            user_id: userId,
          },
        }
      : undefined,
    payment_intent_data: plan.mode === 'payment'
      ? {
          metadata: {
            plan_id: planId,
            agent_id: agentId,
            user_id: userId,
          },
        }
      : undefined,
  });

  sendJson(res, 200, {
    session_id: session.id,
    client_secret: session.client_secret,
    publishable_key: getPublishableKey(),
    plan_id: planId,
  });
}

async function retrieveCheckoutSession(sessionId, res) {
  if (!sessionId) {
    sendJson(res, 400, { error: 'Missing session_id.' });
    return;
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  sendJson(res, 200, {
    id: session.id,
    status: session.status,
    mode: session.mode,
    payment_status: session.payment_status,
    plan_id: session.metadata?.plan_id || null,
    customer_email: session.customer_details?.email || session.customer_email || null,
  });
}

async function stripeCheckoutHandler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' && req.body
        ? JSON.parse(req.body)
        : {};
      await createCheckoutSession(body, req, res);
      return;
    }

    if (req.method === 'GET') {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      await retrieveCheckoutSession(reqUrl.searchParams.get('session_id'), res);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    sendJson(res, 500, {
      error: err?.message || 'Unexpected Stripe checkout error.',
    });
  }
}

module.exports = stripeCheckoutHandler;
