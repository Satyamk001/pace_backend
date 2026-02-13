const db = require('../config/db');
const redis = require('../config/redis');

exports.getDailyLog = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date } = req.query; // YYYY-MM-DD

    const { rows } = await db.query('SELECT * FROM daily_logs WHERE user_id = $1 AND date = $2', [userId, date]);
    res.json(rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.upsertDailyLog = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, dayType, mood } = req.body;

     // Ensure user exists
    await db.query('INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [userId, 'placeholder@email.com']);

    const { rows } = await db.query(
      `INSERT INTO daily_logs (user_id, date, day_type, mood) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, date) 
       DO UPDATE SET day_type = COALESCE(EXCLUDED.day_type, daily_logs.day_type),
                     mood = COALESCE(EXCLUDED.mood, daily_logs.mood)
       RETURNING *`,
      [userId, date, dayType || null, mood || null]
    );
    await redis.del(`calendar:${userId}`); // Invalidate calendar cache
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
