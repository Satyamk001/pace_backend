const db = require('../config/db');

// ─── FOOD TEMPLATES (My Foods) ──────────────────────────────────

exports.getTemplates = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { rows } = await db.query(
      'SELECT * FROM food_templates WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching food templates:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addTemplate = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { name, defaultQuantity, unit, calories, protein, fat, carbs, isAiEstimated } = req.body;

    // Get next sort_order
    const { rows: maxRows } = await db.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM food_templates WHERE user_id = $1',
      [userId]
    );

    const { rows } = await db.query(
      `INSERT INTO food_templates (user_id, name, default_quantity, unit, calories, protein, fat, carbs, is_ai_estimated, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, name, defaultQuantity || null, unit || 'piece', calories || 0, protein || 0, fat || 0, carbs || 0, isAiEstimated || false, maxRows[0].next_order]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error adding food template:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const { name, defaultQuantity, unit, calories, protein, fat, carbs } = req.body;

    const { rows } = await db.query(
      `UPDATE food_templates 
       SET name = COALESCE($3, name), 
           default_quantity = COALESCE($4, default_quantity), 
           unit = COALESCE($5, unit), 
           calories = COALESCE($6, calories),
           protein = COALESCE($7, protein),
           fat = COALESCE($8, fat),
           carbs = COALESCE($9, carbs)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, name, defaultQuantity, unit, calories, protein, fat, carbs]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating food template:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    const { rows } = await db.query(
      'DELETE FROM food_templates WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting food template:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── DAILY FOOD ENTRIES ──────────────────────────────────────────

exports.getDailyEntries = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date } = req.query;

    if (!date) return res.status(400).json({ error: 'Date is required' });

    // Check if entries already exist for this date
    const { rows: existing } = await db.query(
      'SELECT * FROM daily_food_entries WHERE user_id = $1 AND date = $2 ORDER BY is_adhoc ASC, created_at ASC',
      [userId, date]
    );

    if (existing.length > 0) {
      return res.json(existing);
    }

    // Auto-populate from templates for this date
    const { rows: templates } = await db.query(
      'SELECT * FROM food_templates WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [userId]
    );

    if (templates.length === 0) {
      return res.json([]);
    }

    // Insert daily entries from templates
    const values = templates.map((t, i) =>
      `($1, '${t.id}', $2, '${t.name.replace(/'/g, "''")}', '${(t.default_quantity || '').replace(/'/g, "''")}', '${(t.unit || 'piece').replace(/'/g, "''")}', ${t.calories || 0}, ${t.protein || 0}, ${t.fat || 0}, ${t.carbs || 0}, false, false)`
    ).join(', ');

    const { rows: created } = await db.query(
      `INSERT INTO daily_food_entries (user_id, template_id, date, name, quantity, unit, calories, protein, fat, carbs, is_eaten, is_adhoc)
       VALUES ${values}
       RETURNING *`,
      [userId, date]
    );

    res.json(created);
  } catch (error) {
    console.error('Error getting daily food entries:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.toggleEaten = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE daily_food_entries 
       SET is_eaten = NOT is_eaten 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error toggling food eaten:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateDailyEntry = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const { quantity, calories, protein, fat, carbs, unit } = req.body;

    const { rows } = await db.query(
      `UPDATE daily_food_entries 
       SET quantity = COALESCE($3, quantity), 
           calories = COALESCE($4, calories),
           protein = COALESCE($5, protein),
           fat = COALESCE($6, fat),
           carbs = COALESCE($7, carbs),
           unit = COALESCE($8, unit)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, quantity, calories, protein, fat, carbs, unit]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating daily entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addAdhocEntry = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { date, name, quantity, unit, calories, protein, fat, carbs, saveToTemplate } = req.body;

    // Insert the ad-hoc daily entry
    const { rows } = await db.query(
      `INSERT INTO daily_food_entries (user_id, date, name, quantity, unit, calories, protein, fat, carbs, is_eaten, is_adhoc)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true)
       RETURNING *`,
      [userId, date, name, quantity || null, unit || 'piece', calories || 0, protein || 0, fat || 0, carbs || 0]
    );

    // Optionally save to template list
    if (saveToTemplate) {
      const { rows: maxRows } = await db.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM food_templates WHERE user_id = $1',
        [userId]
      );

      const { rows: templateRows } = await db.query(
        `INSERT INTO food_templates (user_id, name, default_quantity, unit, calories, protein, fat, carbs, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, name, quantity || null, unit || 'piece', calories || 0, protein || 0, fat || 0, carbs || 0, maxRows[0].next_order]
      );

      // Link the daily entry to the new template
      await db.query(
        'UPDATE daily_food_entries SET template_id = $1 WHERE id = $2',
        [templateRows[0].id, rows[0].id]
      );

      rows[0].template_id = templateRows[0].id;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error adding ad-hoc food entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteDailyEntry = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    const { rows } = await db.query(
      'DELETE FROM daily_food_entries WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting daily entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── AI CALORIE ESTIMATION ──────────────────────────────────────

exports.estimateCalories = async (req, res) => {
  try {
    const { name, quantity, unit } = req.body;

    if (!name) return res.status(400).json({ error: 'Food name is required' });

    const prompt = `Estimate the calories and macronutrients (protein, fat, carbs) for the following food item. Return ONLY a JSON object with "calories" (integer), "protein" (float), "fat" (float), "carbs" (float), and "confidence" (low/medium/high).

Food: ${name}
Quantity: ${quantity || '1'} ${unit || 'serving'}

Example response: {"calories": 250, "protein": 12.5, "fat": 5.0, "carbs": 30.0, "confidence": "medium"}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gemini-flash-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      const errorMessage = data?.error?.message || data?.error || 'Failed to estimate calories due to AI service error.';
      return res.status(response.status).json({ error: errorMessage });
    }

    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json({ 
          calories: parsed.calories || 0, 
          protein: parsed.protein || 0,
          fat: parsed.fat || 0,
          carbs: parsed.carbs || 0,
          confidence: parsed.confidence || 'low' 
      });
    } else {
      res.json({ calories: 0, protein: 0, fat: 0, carbs: 0, confidence: 'low' });
    }
  } catch (error) {
    console.error('Error estimating calories:', error);
    res.status(500).json({ error: 'Failed to estimate calories' });
  }
};
