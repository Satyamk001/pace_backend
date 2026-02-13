const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const requireAuth = ClerkExpressRequireAuth();

router.get('/stats', requireAuth, reportsController.getStats);
router.get('/calendar', requireAuth, reportsController.getCalendarData);

module.exports = router;
