const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const requireAuth = ClerkExpressRequireAuth();

router.post('/create-order', requireAuth, paymentsController.createOrder);
router.post('/verify', requireAuth, paymentsController.verifyPayment);
router.get('/status', requireAuth, paymentsController.getSubscriptionStatus);

module.exports = router;
