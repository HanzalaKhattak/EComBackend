const express = require('express');
const router = express.Router();
const { createPaymentIntent, saveOrder, getOrders } = require('../controllers/orderController');

router.post('/create-payment-intent', createPaymentIntent);
router.post('/save-order', saveOrder);
router.get('/orders', getOrders);

module.exports = router;
