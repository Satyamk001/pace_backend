const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const runSchema = async () => {
    try {
        const schemaPath = path.join(__dirname, '../db/schema_phase5.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        console.log('Running schema update...');
        await db.query(sql);
        console.log('Schema update successful!');
    } catch (err) {
        console.error('Schema update failed:', err);
    } finally {
        process.exit();
    } // db pool might keep process alive, so exit explicitly
};

runSchema();
