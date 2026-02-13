const express = require('express');
const router = express.Router();
const healthMetricsController = require('../controllers/healthMetricsController');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', healthMetricsController.getHealthMetrics);
router.post('/', healthMetricsController.logHealthMetrics);

module.exports = router;
