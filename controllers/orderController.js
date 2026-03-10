const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

const createPaymentIntent = async (req, res) => {
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
};

const saveOrder = async (req, res) => {
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
};

const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createPaymentIntent, saveOrder, getOrders };
