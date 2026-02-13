const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');

// Create Queue
const dailySummaryQueue = new Queue('daily-summary', { connection: redis });

// Create Worker
const worker = new Worker('daily-summary', async (job) => {
    console.log(`[Job] Processing daily summary for user ${job.data.userId}...`);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`[Job] Summary sent to user ${job.data.userId}!`);
}, { connection: redis });

worker.on('completed', (job) => {
    console.log(`[Job] ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`[Job] ${job.id} has failed with ${err.message}`);
});

module.exports = {
    dailySummaryQueue
};
