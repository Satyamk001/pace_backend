const db = require('./src/config/db');

async function makeUsersPremium() {
    try {
        console.log("Setting all users to premium...");
        await db.query(`
            UPDATE users 
            SET is_premium = true, 
                plan_type = 'PRO_MONTHLY', 
                subscription_end_date = NOW() + INTERVAL '30 days'
        `);
        console.log("Successfully updated users.");
    } catch (error) {
        console.error("Error setting premium:", error);
    } finally {
        process.exit();
    }
}

makeUsersPremium();
