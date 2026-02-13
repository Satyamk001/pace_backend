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
        // If status is 'completed', look at completed_at or updated_at
        // If status is 'pending', look at due_date (planner view)
        // For now, simpler logic:
        // If filtering by date, we generally mean "Tasks for this day"
        // This could mean: Due on this day OR Completed on this day
        query += ` AND (DATE(due_date) = $${paramCount} OR DATE(completed_at) = $${paramCount})`;
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
    const { title, dueDate, energyLevel = 'MEDIUM', progress = 0 } = req.body;
    
    // Ensure user exists (rudimentary sync)
    await db.query('INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [userId, 'placeholder@email.com']); 

    const { rows } = await db.query(
      'INSERT INTO todos (user_id, title, due_date, energy_level, progress) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title, dueDate, energyLevel, progress]
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
    const { title, isCompleted, dueDate, energyLevel, feedback, progress } = req.body;

    const { rows } = await db.query(
      `UPDATE todos 
       SET title = COALESCE($1, title), 
           is_completed = COALESCE($2, is_completed), 
           due_date = COALESCE($3, due_date), 
           energy_level = COALESCE($4, energy_level),
           feedback = COALESCE($5, feedback),
           progress = COALESCE($6, progress),
           completed_at = CASE 
                            WHEN $2::boolean IS TRUE THEN NOW() 
                            WHEN $2::boolean IS FALSE THEN NULL 
                            ELSE completed_at 
                          END
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [title, isCompleted, dueDate, energyLevel, feedback, progress, id, userId]
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
