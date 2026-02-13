const db = require('../config/db');
const redis = require('../config/redis');

exports.getStats = async (req, res) => {
  try {
    const { userId } = req.auth;
    let { range = '7' } = req.query;

    const cacheKey = `stats:${userId}:${range}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
        return res.json(cachedData); 
    }

    // Feature Gating: Check if user is premium
    const { rows: userRows } = await db.query('SELECT is_premium FROM users WHERE id = $1', [userId]);
    const isPremium = userRows[0]?.is_premium;

    // If requesting more than 7 days and not premium, force to 7
    if (parseInt(range) > 7 && !isPremium) {
        range = '7';
    }

    // Get health metrics for the range
    const healthQuery = `
        SELECT 
            date, 
            pain_level, 
            fatigue_level,
            mood
        FROM health_metrics 
        WHERE user_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${range} days' 
        ORDER BY date ASC
    `;
    const { rows: healthRows } = await db.query(healthQuery, [userId]);

    // Get tasks completed per day history
    const tasksQuery = `
        SELECT 
            DATE(completed_at) as date, 
            COUNT(*) as count 
        FROM todos 
        WHERE user_id = $1 
        AND is_completed = true 
        AND completed_at >= CURRENT_DATE - INTERVAL '${range} days' 
        GROUP BY DATE(completed_at) 
        ORDER BY DATE(completed_at) ASC
    `;
    const { rows: taskHistoryRows } = await db.query(tasksQuery, [userId]);

    // Aggregated Stats for Range
    
    // Total Tasks Completed (In Range)
    const totalTasksQuery = `
        SELECT COUNT(*) 
        FROM todos 
        WHERE user_id = $1 
        AND is_completed = true
        AND completed_at >= CURRENT_DATE - INTERVAL '${range} days'
    `;
    const { rows: taskCountRows } = await db.query(totalTasksQuery, [userId]);
    const totalTasks = parseInt(taskCountRows[0].count);

    // Calm Days (In Range)
    const calmDaysQuery = `
        SELECT COUNT(*) 
        FROM daily_logs 
        WHERE user_id = $1 
        AND day_type != 'FLARE_UP'
        AND date >= CURRENT_DATE - INTERVAL '${range} days'
    `;
    const { rows: calmDaysRows } = await db.query(calmDaysQuery, [userId]);
    const calmDays = parseInt(calmDaysRows[0].count);

    // Pain Days (In Range) - NEW
    const painDaysQuery = `
        SELECT COUNT(*) 
        FROM health_metrics 
        WHERE user_id = $1 
        AND pain_level >= 7
        AND date >= CURRENT_DATE - INTERVAL '${range} days'
    `;
    const { rows: painDaysRows } = await db.query(painDaysQuery, [userId]);
    const painDays = parseInt(painDaysRows[0].count);

    // Calculate Streak (Consecutive days with a log - All Time relative to today)
    // Streak is usually "current streak", so it doesn't depend on range.
    const streakQuery = 'SELECT date FROM daily_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 365';
    const { rows: logRows } = await db.query(streakQuery, [userId]);
    
    let streak = 0;
    if (logRows.length > 0) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        // Reset times for accurate comparison
        today.setHours(0,0,0,0);
        yesterday.setHours(0,0,0,0);
        
        const lastLogDate = new Date(logRows[0].date);
        lastLogDate.setHours(0,0,0,0); // Ensure UTC/Local consistency handling if date is YYYY-MM-DD
        // Note: 'date' from postgres might be midnight UTC.
        
        // Check if streak is active (logged today or yesterday)
        const isToday = lastLogDate.getTime() === today.getTime();
        const isYesterday = lastLogDate.getTime() === yesterday.getTime();
        
        if (isToday || isYesterday) {
            streak = 1;
            for (let i = 0; i < logRows.length - 1; i++) {
                const current = new Date(logRows[i].date);
                const next = new Date(logRows[i+1].date);
                
                // Normalize
                current.setHours(0,0,0,0);
                next.setHours(0,0,0,0);

                const diffTime = Math.abs(current.getTime() - next.getTime());
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays === 1) {
                    streak++;
                } else if (diffDays > 1) {
                    break;
                }
            }
        }
    }

    const result = { 
        summary: { totalTasks, calmDays, painDays, streak },
        history: { 
            health: healthRows, 
            tasks: taskHistoryRows 
        } 
    };
    await redis.set(cacheKey, result, 600); // 10 minutes TTL
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
    const cachedData = await redis.get(`calendar:${userId}`);
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
        const dateStr = d.toISOString().split('T')[0];
        
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
    await redis.set(`calendar:${userId}`, calendarData, 300);
    res.json(calendarData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
