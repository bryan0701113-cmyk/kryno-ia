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
        plan TEXT DEFAULT 'free',
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        temperature REAL DEFAULT 0.8,
        allow_swearing INTEGER DEFAULT 1,
        blocked_topics TEXT DEFAULT '',
        system_prompt TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS beta_acesso (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        pin TEXT NOT NULL,
        ativo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed inicial - só roda se a tabela estiver vazia
    const betaCount = await pool.query('SELECT COUNT(*) FROM beta_acesso');
    if (parseInt(betaCount.rows[0].count) === 0) {
      await pool.query(
        'INSERT INTO beta_acesso (email, pin, ativo) VALUES ($1, $2, 1), ($3, $4, 1) ON CONFLICT DO NOTHING',
        ['brayanborges131@gmail.com', '1212', 'igor.dias@example.com', '3434']
      );
      console.log('✅ Beta acesso: usuários iniciais cadastrados');
    }

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
