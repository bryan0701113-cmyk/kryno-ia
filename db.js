const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'kryno.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDB() {
  // Tabela de usuários
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      google_id TEXT,
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Tabela de mensagens (histórico)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_email TEXT,
      user_message TEXT,
      bot_reply TEXT,
      timestamp TEXT
    )
  `).run();

  // Tabela de usuários banidos
  db.prepare(`
    CREATE TABLE IF NOT EXISTS banned_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      banned_at TEXT
    )
  `).run();

  // Índices
  db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)').run();

  console.log('✅ Banco de dados Kryno inicializado');
}

module.exports = { initDB, db };
