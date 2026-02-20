const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const migrate = async () => {
  try {
    console.log('Starting migration...');
    
    // 1. Food Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS food_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        name VARCHAR(255) NOT NULL,
        quantity VARCHAR(100),
        calories INTEGER DEFAULT 0,
        time TIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('- Created food_logs');

    // 2. Medicines
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(50) DEFAULT 'DAILY', 
        times JSONB DEFAULT '[]',             
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('- Created medicines');

    // 3. Medicine Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicine_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        medicine_id UUID,
        date DATE NOT NULL,
        time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'TAKEN',   
        taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );
    `);
    console.log('- Created medicine_logs');

    // 4. Weight Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        weight NUMERIC(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('- Created weight_logs');

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
