const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let initialized = false;

async function initDB() {
  if (initialized) return;
  initialized = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        picture TEXT,
        google_id TEXT,
        role TEXT DEFAULT 'user',
        banned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        user_message TEXT,
        bot_reply TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS banned_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        banned_at TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);

    console.log('✅ Banco de dados Kryno (Postgres) inicializado');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
    initialized = false;
    throw err;
  }
}

module.exports = { initDB, pool };
