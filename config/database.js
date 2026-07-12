const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST || '127.0.0.1',
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      20,              // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection error:', err.stack);
    // Don't exit here if we are just requiring the pool in scripts
    // process.exit(1); 
  } else {
    console.log('✓ PostgreSQL connected');
    release();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => pool.end());

module.exports = pool;
