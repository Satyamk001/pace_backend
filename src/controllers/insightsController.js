const db = require('../config/db');
const redis = require('../config/redis');

exports.getInsights = async (req, res) => {
  try {
    const { userId } = req.auth;

    // Check cache first (6 hour TTL)
    const cacheKey = `insights_v1:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Gather 30 days of correlated data
    const query = `
      WITH date_range AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '30 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      daily_calories AS (
        SELECT date, SUM(calories) AS total_calories, COUNT(*) AS items_eaten
        FROM daily_food_entries
        WHERE user_id = $1 AND is_eaten = true AND date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date
      ),
      health AS (
        SELECT date, pain_level, fatigue_level, mood
        FROM health_metrics
        WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      weight AS (
        SELECT date, weight
        FROM weight_logs
        WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT
        dr.date,
        dc.total_calories,
        dc.items_eaten,
        h.pain_level,
        h.fatigue_level,
        h.mood,
        w.weight
      FROM date_range dr
      LEFT JOIN daily_calories dc ON dr.date = dc.date
      LEFT JOIN health h ON dr.date = h.date
      LEFT JOIN weight w ON dr.date = w.date
      WHERE dc.total_calories IS NOT NULL OR h.pain_level IS NOT NULL OR w.weight IS NOT NULL
      ORDER BY dr.date ASC
    `;

    const { rows } = await db.query(query, [userId]);

    // Need at least 5 data points for meaningful insights
    const daysWithData = rows.filter(r => r.total_calories || r.pain_level !== null);
    if (daysWithData.length < 5) {
      return res.json({
        insights: [],
        message: 'Keep logging for a few more days to unlock health insights!',
        daysLogged: daysWithData.length,
        daysNeeded: 5,
      });
    }

    // Build data summary for AI
    const dataSummary = rows.map(r => ({
      date: r.date,
      calories: r.total_calories ? parseInt(r.total_calories) : null,
      pain: r.pain_level,
      fatigue: r.fatigue_level,
      mood: r.mood,
      weight: r.weight ? parseFloat(r.weight) : null,
    }));

    const prompt = `You are a health analytics assistant. Analyze the following 30-day health data and identify meaningful correlations and patterns. Focus on relationships between calorie intake, pain levels, fatigue levels, mood, and weight.

DATA (JSON array, one entry per day):
${JSON.stringify(dataSummary)}

Rules:
- Return EXACTLY a JSON array of 3 to 5 insight objects
- Each insight must have: "title" (short, catchy), "insight" (1-2 sentences with specific numbers/percentages where possible), "type" (one of: "positive", "warning", "info", "tip")
- Only report correlations you actually observe in the data
- If data is too sparse for a category, skip it
- Be specific with numbers, don't be vague
- Write in second person ("your", "you")

Example format:
[
  {"title": "Low Calorie Alert", "insight": "On days you consumed less than 1200 calories, your fatigue level averaged 7.2 compared to 4.1 on higher-calorie days.", "type": "warning"},
  {"title": "Energy Boost", "insight": "Your pain levels were 35% lower on days when you ate more than 1800 calories.", "type": "positive"}
]

Return ONLY the JSON array, no markdown or extra text.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gemini-flash-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';

    // Parse JSON from response (handle markdown code blocks)
    let insights = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse AI insights:', parseErr);
      insights = [];
    }

    const result = {
      insights,
      daysLogged: daysWithData.length,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 6 hours
    await redis.set(cacheKey, result, 21600);
    res.json(result);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
};
