const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

// Raw body is required by Stripe for signature verification — applied here, not globally
router.post('/', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
