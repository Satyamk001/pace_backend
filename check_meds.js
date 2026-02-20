const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
   ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const checkDB = async () => {
  try {
    console.log('Checking medicines table...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'medicines'
    `);
    
    if (tableCheck.rows.length === 0) {
        console.log('❌ Table medicines DOES NOT exist.');
    } else {
        console.log('✅ Table medicines exists.');
        
        const rows = await pool.query('SELECT * FROM medicines');
        console.log(`Found ${rows.rowCount} rows in medicines.`);
        console.log(rows.rows);

        // Try dummy insert
        try {
             // We need a valid user ID. Let's pick one from users table if exists
             const userRes = await pool.query('SELECT id FROM users LIMIT 1');
             if (userRes.rows.length > 0) {
                 const userId = userRes.rows[0].id;
                 console.log(`Testing insert for user ${userId}...`);
                 const insertRes = await pool.query(
                    `INSERT INTO medicines (user_id, name, dosage, frequency, times)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [userId, 'Test Med', '10mg', 'DAILY', JSON.stringify(['08:00'])]
                 );
                 console.log('✅ Insert successful:', insertRes.rows[0]);
                 
                 // Cleanup
                 await pool.query('DELETE FROM medicines WHERE id = $1', [insertRes.rows[0].id]);
                 console.log('✅ Cleanup successful.');

             } else {
                 console.log('⚠️ No users found to test insert.');
             }
        } catch (insertErr) {
            console.error('❌ Insert failed:', insertErr);
        }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkDB();
