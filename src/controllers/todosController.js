const db = require('../config/db');

exports.getAllTodos = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, status } = req.query;

    let query = 'SELECT * FROM todos WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (date) {
        paramCount++;
        // Non-repeating: exact date match
        // DAILY: due_date <= queryDate (shows every day from start)
        // WEEKLY: due_date <= queryDate AND same weekday
        // MONTHLY: due_date <= queryDate AND same day-of-month
        // YEARLY: due_date <= queryDate AND same month + day
        query += ` AND (
          (repeat_type IS NULL OR repeat_type = 'NONE') AND (DATE(due_date) = $${paramCount} OR DATE(completed_at) = $${paramCount})
          OR (repeat_type = 'DAILY' AND DATE(due_date) <= $${paramCount} AND is_completed = false)
          OR (repeat_type = 'WEEKLY' AND DATE(due_date) <= $${paramCount} AND is_completed = false
              AND EXTRACT(DOW FROM due_date) = EXTRACT(DOW FROM $${paramCount}::date))
          OR (repeat_type = 'MONTHLY' AND DATE(due_date) <= $${paramCount} AND is_completed = false
              AND EXTRACT(DAY FROM due_date) = EXTRACT(DAY FROM $${paramCount}::date))
          OR (repeat_type = 'YEARLY' AND DATE(due_date) <= $${paramCount} AND is_completed = false
              AND EXTRACT(MONTH FROM due_date) = EXTRACT(MONTH FROM $${paramCount}::date)
              AND EXTRACT(DAY FROM due_date) = EXTRACT(DAY FROM $${paramCount}::date))
        )`;
        params.push(date);
    }
    
    if (status === 'active') {
        query += ` AND is_completed = false`;
    } else if (status === 'completed') {
        query += ` AND is_completed = true`;
    }

    query += ' ORDER BY is_completed ASC, energy_level DESC, created_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createTodo = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { title, dueDate, energyLevel = 'MEDIUM', progress = 0, feedback = null, repeatType = 'NONE' } = req.body;
    
    // Ensure user exists (rudimentary sync)
    await db.query('INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [userId, 'placeholder@email.com']); 

    const { rows } = await db.query(
      'INSERT INTO todos (user_id, title, due_date, energy_level, progress, feedback, repeat_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, title, dueDate, energyLevel, progress, feedback, repeatType]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.auth;
    const { title, isCompleted, dueDate, energyLevel, feedback, progress, repeatType } = req.body;

    const { rows } = await db.query(
      `UPDATE todos 
       SET title = COALESCE($1, title), 
           is_completed = COALESCE($2, is_completed), 
           due_date = COALESCE($3, due_date), 
           energy_level = COALESCE($4, energy_level),
           feedback = COALESCE($5, feedback),
           progress = COALESCE($6, progress),
           repeat_type = COALESCE($7, repeat_type),
           completed_at = CASE 
                            WHEN $2::boolean IS TRUE THEN NOW() 
                            WHEN $2::boolean IS FALSE THEN NULL 
                            ELSE completed_at 
                          END
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [title, isCompleted, dueDate, energyLevel, feedback, progress, repeatType, id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.auth;
    const { rowCount } = await db.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [id, userId]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
