const db = require('../config/db');
const redis = require('../config/redis');

exports.getStats = async (req, res) => {
  try {
    const { userId } = req.auth;
    let { range = '7' } = req.query;

    const cacheKey = `stats_v3:${userId}:${range}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        return res.json(cachedData); 
    }

    // Feature Gating: Check if user is premium
    const { rows: userRows } = await db.query('SELECT is_premium FROM users WHERE id = $1', [userId]);
    const isPremium = userRows[0]?.is_premium;

    // If requesting more than 30 days and not premium, force to 30
    if (parseInt(range) > 30 && !isPremium) {
        range = '30';
    }

    // ── Query 1: Health + task history (for graph) + aggregated stats in ONE query ──
    const mainQuery = `
        WITH health AS (
            SELECT 
                date, pain_level, fatigue_level, mood
            FROM health_metrics 
            WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${range} days'
        ),
        task_history AS (
            SELECT 
                DATE(completed_at) as date, COUNT(*) as count 
            FROM todos 
            WHERE user_id = $1 AND is_completed = true 
                AND completed_at >= CURRENT_DATE - INTERVAL '${range} days' 
            GROUP BY DATE(completed_at)
        ),
        task_agg AS (
            SELECT 
                COUNT(*) FILTER (WHERE is_completed = true AND completed_at >= CURRENT_DATE - INTERVAL '${range} days') as completed,
                COUNT(*) FILTER (WHERE due_date >= CURRENT_DATE - INTERVAL '${range} days') as total
            FROM todos WHERE user_id = $1
        ),
        health_agg AS (
            SELECT
                COUNT(*) FILTER (WHERE pain_level > 5) as high_pain_days,
                COUNT(*) FILTER (WHERE pain_level < 3) as calm_days,
                ROUND(AVG(pain_level)::numeric, 1) as avg_pain,
                ROUND(AVG(fatigue_level)::numeric, 1) as avg_fatigue,
                COUNT(*) as total_logged
            FROM health
        )
        SELECT 
            (SELECT json_agg(h ORDER BY h.date ASC) FROM health h) as health_rows,
            (SELECT json_agg(t ORDER BY t.date ASC) FROM task_history t) as task_rows,
            (SELECT row_to_json(ta) FROM task_agg ta) as task_agg,
            (SELECT row_to_json(ha) FROM health_agg ha) as health_agg
    `;
    const { rows: [mainResult] } = await db.query(mainQuery, [userId]);

    const healthRows = mainResult.health_rows || [];
    const taskHistoryRows = mainResult.task_rows || [];
    const taskAgg = mainResult.task_agg || { completed: 0, total: 0 };
    const healthAgg = mainResult.health_agg || { high_pain_days: 0, calm_days: 0, avg_pain: 0, avg_fatigue: 0, total_logged: 0 };

    const totalTasks = parseInt(taskAgg.completed) || 0;
    const totalTasksCreated = parseInt(taskAgg.total) || 0;
    const completionRate = totalTasksCreated > 0 ? Math.round((totalTasks / totalTasksCreated) * 100) : 0;

    // ── Query 2: Streak (always all-time, doesn't depend on range) ──
    const streakQuery = 'SELECT date FROM daily_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 365';
    const { rows: logRows } = await db.query(streakQuery, [userId]);
    
    let streak = 0;
    if (logRows.length > 0) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        today.setHours(0,0,0,0);
        yesterday.setHours(0,0,0,0);
        
        const lastLogDate = new Date(logRows[0].date);
        lastLogDate.setHours(0,0,0,0);
        
        if (lastLogDate.getTime() === today.getTime() || lastLogDate.getTime() === yesterday.getTime()) {
            streak = 1;
            for (let i = 0; i < logRows.length - 1; i++) {
                const current = new Date(logRows[i].date);
                const next = new Date(logRows[i+1].date);
                current.setHours(0,0,0,0);
                next.setHours(0,0,0,0);
                const diffDays = Math.round(Math.abs(current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) streak++;
                else if (diffDays > 1) break;
            }
        }
    }

    const result = { 
        summary: { 
            totalTasks, 
            completionRate,
            calmDays: parseInt(healthAgg.calm_days) || 0,
            painDays: parseInt(healthAgg.high_pain_days) || 0,
            avgPain: parseFloat(healthAgg.avg_pain) || 0,
            avgFatigue: parseFloat(healthAgg.avg_fatigue) || 0,
            streak 
        },
        history: { 
            health: healthRows, 
            tasks: taskHistoryRows 
        } 
    };
    await redis.set(cacheKey, result, 600);
    res.json(result); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCalendarData = async (req, res) => {
  try {
    const { userId } = req.auth;
    
    // Check cache
    const cachedData = await redis.get(`calendar_v2:${userId}`);
    if (cachedData) {
         return res.json(cachedData);
    }

    // Feature Gating
    const { rows: userRows } = await db.query('SELECT is_premium FROM users WHERE id = $1', [userId]);
    const isPremium = userRows[0]?.is_premium;

    let dateFilter = '';
    // If NOT premium, maybe limit history? For now, let's just show all for calendar or limit to 30 days.
    // User didn't strictly ask for limit, but let's keep it performant. 
    // Actually, full month calendar needs more than 7 days. Let's allow 60 days back for free users? 
    // Or just all time for now since dataset is small.
    if (!isPremium) {
       dateFilter = "AND dl.date >= NOW() - INTERVAL '60 days'";
    }

    const query = `
        WITH TaskStats AS (
            SELECT 
                user_id,
                DATE(due_date) as date, -- Use due_date for calendar placement
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE is_completed = true) as completed_tasks
            FROM todos
            WHERE user_id = $1 AND due_date IS NOT NULL
            GROUP BY user_id, DATE(due_date)
        ),
        DailyHealth AS (
            SELECT 
                dl.user_id,
                dl.date,
                dl.day_type,
                hm.pain_level
            FROM daily_logs dl
            LEFT JOIN health_metrics hm ON dl.user_id = hm.user_id AND dl.date = hm.date
            WHERE dl.user_id = $1
        )
        SELECT 
            COALESCE(dh.date, ts.date) as date,
            dh.day_type,
            dh.pain_level,
            COALESCE(ts.total_tasks, 0) as total_tasks,
            COALESCE(ts.completed_tasks, 0) as completed_tasks
        FROM DailyHealth dh
        FULL OUTER JOIN TaskStats ts ON dh.date = ts.date AND dh.user_id = ts.user_id
        WHERE (dh.date IS NOT NULL OR ts.date IS NOT NULL)
        ${dateFilter ? dateFilter.replace('dl.date', 'COALESCE(dh.date, ts.date)') : ''}
    `;

    const { rows } = await db.query(query, [userId]);
    
    const calendarData = {};
    rows.forEach(row => {
        const d = new Date(row.date);
        // Fix: Manual construction to avoid toISOString() shifting dates in East timezones (e.g. IST)
        // pg driver parses DATE columns as local midnight. toISOString converts to UTC, shifting back.
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        let completionPercent = 0;
        if (parseInt(row.total_tasks) > 0) {
            completionPercent = Math.round((parseInt(row.completed_tasks) / parseInt(row.total_tasks)) * 100);
        }

        calendarData[dateStr] = {
            day_type: row.day_type,
            pain_level: row.pain_level,
            total_tasks: parseInt(row.total_tasks),
            completion_percent: completionPercent
        };
    });

    // Cache for 5 mins
    await redis.set(`calendar_v2:${userId}`, calendarData, 300);
    res.json(calendarData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
