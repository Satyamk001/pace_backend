const db = require('../config/db');

exports.logWeight = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, weight } = req.body;

    const { rows } = await db.query(
      `INSERT INTO weight_logs (user_id, date, weight)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET weight = EXCLUDED.weight
       RETURNING *`,
      [userId, date, weight]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error logging weight:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getWeightHistory = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { startDate, endDate } = req.query;

    let query = 'SELECT * FROM weight_logs WHERE user_id = $1';
    const params = [userId];
    
    if (startDate && endDate) {
        query += ' AND date BETWEEN $2 AND $3';
        params.push(startDate, endDate);
    }
    
    query += ' ORDER BY date ASC';

    const { rows } = await db.query(query, params);
    
    // Server-side Aggregation
    let min = 0, max = 0, avg = 0;
    if (rows.length > 0) {
        const weights = rows.map(r => parseFloat(r.weight));
        min = Math.min(...weights);
        max = Math.max(...weights);
        const sum = weights.reduce((acc, val) => acc + val, 0);
        avg = sum / weights.length;
    }

    res.json({
        history: rows,
        stats: { min, max, avg }
    });
  } catch (error) {
    console.error('Error fetching weight history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
