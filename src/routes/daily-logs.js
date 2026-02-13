const express = require('express');
const router = express.Router();
const dailyLogsController = require('../controllers/dailyLogsController');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', dailyLogsController.getDailyLog);
router.post('/', dailyLogsController.upsertDailyLog);

module.exports = router;
