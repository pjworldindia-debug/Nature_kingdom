const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Read and sort files numerically (001, 002, etc.)
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
    }

    await client.query('COMMIT');
    console.log('✓ All migrations applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
