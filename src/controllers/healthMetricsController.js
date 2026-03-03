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
    const { date, painLevel, fatigueLevel, mood, notes, painkillerCount } = req.body;

    const { rows } = await db.query(
      `INSERT INTO health_metrics (user_id, date, pain_level, fatigue_level, mood, notes, painkiller_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date)
       DO UPDATE SET 
         pain_level = EXCLUDED.pain_level,
         fatigue_level = EXCLUDED.fatigue_level,
         mood = EXCLUDED.mood,
         notes = EXCLUDED.notes,
         painkiller_count = EXCLUDED.painkiller_count
       RETURNING *`,
      [userId, date, painLevel, fatigueLevel, mood, notes, painkillerCount ?? 0]
    );

    // Context Engine Logic: auto-flag FLARE_UP if pain is high
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
