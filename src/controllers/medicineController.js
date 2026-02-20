const db = require('../config/db');

// --- Medicines Management ---

exports.addMedicine = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { name, dosage, frequency, times } = req.body; // times is an array of strings like ["08:00", "20:00"]

    const { rows } = await db.query(
      `INSERT INTO medicines (user_id, name, dosage, frequency, times)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, dosage, frequency, JSON.stringify(times)]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error adding medicine:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMedicines = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { rows } = await db.query(
      'SELECT * FROM medicines WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteMedicine = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;
        await db.query('DELETE FROM medicines WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: 'Medicine deleted'});
    } catch (error) {
        console.error('Error deleting medicine:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateMedicine = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;
        const { name, dosage, frequency, times } = req.body;

        const { rows } = await db.query(
            `UPDATE medicines 
             SET name = $1, dosage = $2, frequency = $3, times = $4
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [name, dosage, frequency, JSON.stringify(times), id, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Medicine not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating medicine:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- Intake Logging ---

exports.logIntake = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { medicineId, date, time, status } = req.body; // status: 'TAKEN' or 'SKIPPED'

    const { rows } = await db.query(
      `INSERT INTO medicine_logs (user_id, medicine_id, date, time, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, medicineId, date, time, status || 'TAKEN']
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error logging medicine intake:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteIntake = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { medicineId, date, time } = req.query; // Changed to req.query
        
        if (!medicineId || !date || !time) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        await db.query(
            `DELETE FROM medicine_logs 
             WHERE user_id = $1 AND medicine_id = $2 AND date = $3 AND time = $4`,
            [userId, medicineId, date, time]
        );
        res.json({ message: 'Intake deleted' });
    } catch (error) {
        console.error('Error deleting medicine intake:', error);
        console.error('Params:', { userId: req.auth.userId, medicineId: req.query.medicineId, date: req.query.date, time: req.query.time });
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

exports.getIntakeHistory = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { date } = req.query;

    const { rows } = await db.query(
      `SELECT ml.*, m.name as medicine_name 
       FROM medicine_logs ml
       JOIN medicines m ON ml.medicine_id = m.id
       WHERE ml.user_id = $1 AND ml.date = $2
       ORDER BY ml.time ASC`,
      [userId, date]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching intake history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
