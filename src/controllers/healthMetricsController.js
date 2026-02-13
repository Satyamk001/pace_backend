const db = require('../config/db');

exports.getHealthMetrics = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date } = req.query;

    const { rows } = await db.query(
      'SELECT * FROM health_metrics WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    res.json(rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.logHealthMetrics = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, painLevel, fatigueLevel, mood, notes } = req.body;

    const { rows } = await db.query(
      `INSERT INTO health_metrics (user_id, date, pain_level, fatigue_level, mood, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date)
       DO UPDATE SET 
         pain_level = EXCLUDED.pain_level,
         fatigue_level = EXCLUDED.fatigue_level,
         mood = EXCLUDED.mood,
         notes = EXCLUDED.notes
       RETURNING *`,
      [userId, date, painLevel, fatigueLevel, mood, notes]
    );

    // Context Engine Logic (Start of "Intelligence")
    // If pain > 7, we might want to suggest marking the day as 'FLARE_UP' automatically if not already
    if (painLevel >= 7) {
        await db.query(
            `INSERT INTO daily_logs (user_id, date, day_type) 
             VALUES ($1, $2, 'FLARE_UP') 
             ON CONFLICT (user_id, date) 
             DO UPDATE SET day_type = 'FLARE_UP' 
             WHERE daily_logs.day_type != 'FLARE_UP'`,
            [userId, date]
        );
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
