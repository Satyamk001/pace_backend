const db = require('../config/db');

exports.logFood = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, name, quantity, calories, time, notes } = req.body;

    const { rows } = await db.query(
      `INSERT INTO food_logs (user_id, date, name, quantity, calories, time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, date, name, quantity, calories || 0, time, notes]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error logging food:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getDailyFoodLog = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date } = req.query;

    const { rows } = await db.query(
      'SELECT * FROM food_logs WHERE user_id = $1 AND date = $2 ORDER BY time ASC',
      [userId, date]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching food log:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteFoodLog = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    const { rows } = await db.query(
      'DELETE FROM food_logs WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting food log:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
