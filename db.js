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

    // PRIVACIDADE (LGPD): apagar histórico guest que vazou no backend.
    // Guests nunca devem ter mensagens salvas no servidor.
    try {
      const del = await pool.query("DELETE FROM messages WHERE user_id = 'anonimo'");
      if (del.rowCount > 0) console.log(`🧹 Limpeza LGPD: ${del.rowCount} mensagens de guest apagadas do servidor`);
    } catch (e) {
      console.log('Cleanup guest skip:', e.message);
    }

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

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);

    // ===== GOD MODE (Nível 3) =====
    // Analytics: modelo usado e país de cada mensagem
    try {
      await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS model TEXT DEFAULT ''`);
      await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS country TEXT DEFAULT ''`);
    } catch {}

    // Feature Flags: liberar função nova só pra X% dos usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        rollout INTEGER DEFAULT 100,
        description TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Config global (Kill Switch etc)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        kill_switch INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`INSERT INTO app_config (id, kill_switch) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);

    console.log('✅ Banco de dados Kryno (Postgres) inicializado');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
    initialized = false;
    throw err;
  }
}

module.exports = { initDB, pool };
