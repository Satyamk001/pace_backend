const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

module.exports = {
    redis,
    get: async (key) => {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    },
    set: async (key, value, ttlSeconds = 3600) => {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },
    del: async (key) => {
        await redis.del(key);
    }
};
