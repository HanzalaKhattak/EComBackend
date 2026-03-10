const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Stripe webhook must be registered before express.json() to receive raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
app.use(express.json());

// MongoDB connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGODB_URI not set — orders will not be persisted');
}

// Order schema to track payments
const orderSchema = new mongoose.Schema({
  paymentIntentId: { type: String, required: true, unique: true },
  paymentMethodId: String,
  amount: Number,
  currency: { type: String, default: 'usd' },
  status: { type: String, default: 'pending' },
  customer: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  items: Array,
  orderNotes: String,
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

// Create a Stripe PaymentIntent and return its client secret to the frontend
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', customerInfo } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects amount in cents
      currency,
      metadata: {
        customerEmail: customerInfo?.email || '',
        customerName: `${customerInfo?.firstName || ''} ${customerInfo?.lastName || ''}`.trim(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save order details after a successful payment (verified with Stripe)
app.post('/api/save-order', async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId, amount, currency, customerInfo, items, orderNotes } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    // Verify payment status directly with Stripe before saving
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not completed. Status: ${paymentIntent.status}` });
    }

    const order = new Order({
      paymentIntentId,
      paymentMethodId,
      amount,
      currency: currency || 'usd',
      status: paymentIntent.status,
      customer: customerInfo,
      items,
      orderNotes,
    });

    await order.save();
    res.json({ success: true, orderId: order._id });
  } catch (error) {
    // Duplicate key — order already exists (idempotency guard)
    if (error.code === 11000) {
      return res.json({ success: true, message: 'Order already recorded' });
    }
    console.error('Error saving order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all orders (admin use)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
