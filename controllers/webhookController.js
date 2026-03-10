const Order = require('../models/Order');

const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);

const handleWebhook = async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      await Order.findOneAndUpdate({ paymentIntentId: pi.id }, { status: 'succeeded' }).catch(console.error);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await Order.findOneAndUpdate({ paymentIntentId: pi.id }, { status: 'failed' }).catch(console.error);
      break;
    }
  }

  res.json({ received: true });
};

module.exports = { handleWebhook };
