const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');

const healthMetricsController = require('../controllers/healthMetricsController');
const foodController = require('../controllers/foodController');
const foodTemplateController = require('../controllers/foodTemplateController');
const insightsController = require('../controllers/insightsController');
const medicineController = require('../controllers/medicineController');
const weightController = require('../controllers/weightController');

// Existing Health Metrics
router.get('/', requireAuth, healthMetricsController.getHealthMetrics);
router.post('/', requireAuth, healthMetricsController.logHealthMetrics);

// Food Logs (legacy)
router.post('/food', requireAuth, foodController.logFood);
router.get('/food/daily', requireAuth, foodController.getDailyFoodLog);
router.delete('/food/:id', requireAuth, foodController.deleteFoodLog);

// Food Templates (My Foods)
router.get('/food-templates', requireAuth, foodTemplateController.getTemplates);
router.post('/food-templates', requireAuth, foodTemplateController.addTemplate);
router.put('/food-templates/:id', requireAuth, foodTemplateController.updateTemplate);
router.delete('/food-templates/:id', requireAuth, foodTemplateController.deleteTemplate);

// Daily Food Entries (checklist)
router.get('/food-templates/daily', requireAuth, foodTemplateController.getDailyEntries);
router.put('/food-templates/daily/:id/toggle', requireAuth, foodTemplateController.toggleEaten);
router.put('/food-templates/daily/:id', requireAuth, foodTemplateController.updateDailyEntry);
router.post('/food-templates/daily', requireAuth, foodTemplateController.addAdhocEntry);
router.delete('/food-templates/daily/:id', requireAuth, foodTemplateController.deleteDailyEntry);

// AI Calorie Estimation
router.post('/food-templates/estimate-calories', requireAuth, foodTemplateController.estimateCalories);

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

// Health Insights (AI-powered)
router.get('/insights', requireAuth, insightsController.getInsights);

module.exports = router;

