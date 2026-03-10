const mongoose = require('mongoose');

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

module.exports = mongoose.model('Order', orderSchema);
