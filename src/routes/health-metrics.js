const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');

const healthMetricsController = require('../controllers/healthMetricsController');
const foodController = require('../controllers/foodController');
const medicineController = require('../controllers/medicineController');
const weightController = require('../controllers/weightController');

// Existing Health Metrics
router.get('/', requireAuth, healthMetricsController.getHealthMetrics);
router.post('/', requireAuth, healthMetricsController.logHealthMetrics);

// Food Logs
router.post('/food', requireAuth, foodController.logFood);
router.get('/food/daily', requireAuth, foodController.getDailyFoodLog);
router.delete('/food/:id', requireAuth, foodController.deleteFoodLog);

// Medicine Intake FIRST to avoid collision with /:id
router.post('/medicines/intake', requireAuth, medicineController.logIntake);
router.delete('/medicines/intake', requireAuth, medicineController.deleteIntake);
router.get('/medicines/intake/history', requireAuth, medicineController.getIntakeHistory);

// Medicines Management
router.post('/medicines', requireAuth, medicineController.addMedicine);
router.get('/medicines', requireAuth, medicineController.getMedicines);
router.put('/medicines/:id', requireAuth, medicineController.updateMedicine);
router.delete('/medicines/:id', requireAuth, medicineController.deleteMedicine);

// Weight Logs
router.post('/weight', requireAuth, weightController.logWeight);
router.get('/weight/history', requireAuth, weightController.getWeightHistory);

module.exports = router;
