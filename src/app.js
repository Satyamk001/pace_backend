const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Routes
const todosRoutes = require('./routes/todos');
const dailyLogsRoutes = require('./routes/daily-logs');
const healthMetricsRoutes = require('./routes/health-metrics');
const reportsRoutes = require('./routes/reports');
const paymentsRoutes = require('./routes/payments');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const { dailySummaryQueue } = require('./jobs/dailySummary');

// Routes
app.use('/api/todos', todosRoutes);
app.use('/api/daily-logs', dailyLogsRoutes);
app.use('/api/health-metrics', healthMetricsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);

// Test Route for Background Jobs
app.post('/api/jobs/trigger-summary', async (req, res) => {
    const { userId } = req.body;
    await dailySummaryQueue.add('send-summary', { userId });
    res.json({ message: 'Job added to queue' });
});

// Health check
app.get('/', (req, res) => {
  res.send('PACE Backend is running');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
