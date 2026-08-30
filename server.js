const express = require('express');
const multer = require('multer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB, db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO =====
const ADMIN_PASS = process.env.ADMIN_PASS || 'Kryno2026';
const ADMIN_PIN = process.env.ADMIN_PIN || '1212';
const JWT_SECRET = process.env.JWT_SECRET || 'kryno-secret';

// Inicializar banco
initDB();

// ===== MIDDLEWARES =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// ===== OPENAI =====
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-sua-chave-aqui') {
  const { OpenAI } = require('openai');
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ===== PASSPORT GOOGLE =====
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'seu-client-id') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const picture = profile.photos?.[0]?.value || '';

    // Verificar banimento
    const banned = db.prepare('SELECT * FROM banned_users WHERE email = ?').get(email);
    if (banned) return done(null, false, { message: 'Usuário banido' });

    // Criar ou atualizar usuário
    db.prepare(`INSERT OR IGNORE INTO users (email, name, picture, google_id) VALUES (?, ?, ?, ?)`)
      .run(email, name, picture, profile.id);
    db.prepare(`UPDATE users SET name = ?, picture = ?, google_id = ? WHERE email = ?`)
      .run(name, picture, profile.id, email);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return done(null, { user, token });
  }));
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ===== ROTAS DE AUTENTICAÇÃO =====

// Login com Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=login_failed' }),
  (req, res) => {
    res.cookie('token', req.user.token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  }
);

// Logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  req.logout(() => {});
  res.json({ success: true });
});

// Status do usuário
app.get('/auth/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ authenticated: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, user: decoded });
  } catch {
    res.json({ authenticated: false });
  }
});

// ===== SISTEMA DE COMANDOS DA KRYNO =====

// Chat principal - processa qualquer comando da lista
app.post('/api/chat', async (req, res) => {
  const { message, image, audio, history } = req.body;
  const token = req.cookies.token;
  let userId = 'anonimo';
  let userEmail = 'anonimo';

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
      userEmail = decoded.email;
    } catch {}
  }

  if (!openai) {
    return res.json({
      reply: 'Olá! Sou a Kryno IA 🔥\n\nEstou quase pronta! Para funcionar 100%, preciso que você configure a OPENAI_API_KEY nas variáveis de ambiente na Railway.\n\nMas já posso te ajudar com várias coisas! Me diz o que você precisa. 🤖'
    });
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `Você é a Kryno IA, uma inteligência artificial brasileira criada para ajudar em TUDO. Você é amigável, divertida, usa emojis e fala em português do Brasil. Sempre dê respostas completas e úteis. Você tem conhecimento em: conselhos amorosos, estudos, trabalho, receitas, treinos, dicas, e muito mais. Seja sempre positiva e encorajadora.`
      }
    ];

    // Adicionar histórico da conversa
    if (history && history.length > 0) {
      history.forEach(h => messages.push({ role: h.role, content: h.content }));
    }

    // Verificar se tem imagem
    if (image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message || 'Analise esta imagem.' },
          { type: 'image_url', image_url: { url: image } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    const response = await openai.chat.completions.create({
      model: image ? 'gpt-4o' : 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.8
    });

    const reply = response.choices[0].message.content;

    // Salvar no histórico
    db.prepare(`INSERT INTO messages (user_id, user_email, user_message, bot_reply, timestamp) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, userEmail, message || '[imagem]', reply, new Date().toISOString());

    res.json({ reply });
  } catch (err) {
    console.error('Erro no chat:', err.message);
    res.json({ reply: 'Ops! Deu um erro aqui 😅 Tenta de novo!' });
  }
});

// ===== COMANDO "IMAGINA" - Geração de Imagem =====
app.post('/api/imagina', async (req, res) => {
  const { prompt } = req.body;

  if (!openai) {
    return res.json({ error: 'OPENAI_API_KEY não configurada' });
  }

  try {
    // Detectar se o prompt começa com "imagina"
    let cleanPrompt = prompt;
    if (cleanPrompt.toLowerCase().startsWith('imagina ')) {
      cleanPrompt = cleanPrompt.substring(8);
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Crie uma imagem: ${cleanPrompt}. Estilo detalhado e vibrante.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard'
    });

    res.json({ image_url: response.data[0].url, prompt: cleanPrompt });
  } catch (err) {
    console.error('Erro ao gerar imagem:', err.message);
    res.json({ error: 'Não consegui gerar a imagem 😢 Tenta descrever de outro jeito!' });
  }
});

// ===== TRANSCRIÇÃO DE ÁUDIO =====
app.post('/api/transcrever', upload.single('audio'), async (req, res) => {
  if (!openai || !req.file) {
    return res.json({ error: 'Áudio não recebido ou API não configurada' });
  }

  try {
    const tempPath = path.join(__dirname, 'temp_audio_' + Date.now() + '.mp3');
    fs.writeFileSync(tempPath, req.file.buffer);

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'pt'
    });

    fs.unlinkSync(tempPath);
    res.json({ text: response.text });
  } catch (err) {
    console.error('Erro ao transcrever:', err.message);
    res.json({ error: 'Não consegui transcrever o áudio 😢' });
  }
});

// ===== HISTÓRICO =====
app.get('/api/historico', authMiddleware, (req, res) => {
  const messages = db.prepare(`SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50`)
    .all(req.user.id);
  res.json({ messages });
});

app.get('/api/historico/buscar', authMiddleware, (req, res) => {
  const { q } = req.query;
  const messages = db.prepare(`SELECT * FROM messages WHERE user_id = ? AND (user_message LIKE ? OR bot_reply LIKE ?) ORDER BY timestamp DESC`)
    .all(req.user.id, `%${q}%`, `%${q}%`);
  res.json({ messages });
});

app.delete('/api/historico', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM messages WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

app.delete('/api/historico/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.get('/api/historico/exportar', authMiddleware, (req, res) => {
  const messages = db.prepare(`SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC`).all(req.user.id);
  let txt = '=== HISTÓRICO KRYNO IA ===\n\n';
  messages.forEach(m => {
    txt += `[${m.timestamp}]\nVocê: ${m.user_message}\nKryno: ${m.bot_reply}\n\n---\n\n`;
  });
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="historico-kryno.txt"');
  res.send(txt);
});

app.get('/api/historico/ultimas', authMiddleware, (req, res) => {
  const messages = db.prepare(`SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10`).all(req.user.id);
  res.json({ messages, count: messages.length });
});

// ===== PAINEL ADMIN =====

// Login admin
app.post('/api/admin/login', (req, res) => {
  const { pass, pin } = req.body;
  if ((pass === ADMIN_PASS) || (pin === ADMIN_PIN)) {
    const token = jwt.sign({ role: 'admin', email: 'admin@kryno' }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Senha ou PIN incorretos' });
  }
});

// Ver todos os usuários
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, email, name, picture, role, created_at, banned FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// Ver histórico de qualquer usuário
app.get('/api/admin/users/:id/historico', adminMiddleware, (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100').all(req.params.id);
  res.json({ messages });
});

// Estatísticas
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
  const bannedUsers = db.prepare('SELECT COUNT(*) as count FROM banned_users').get().count;
  const todayMessages = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE date(timestamp) = date('now')`).get().count;

  // Mensagens por dia (últimos 7 dias)
  const messagesPerDay = db.prepare(`
    SELECT date(timestamp) as date, COUNT(*) as count
    FROM messages
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY date(timestamp)
    ORDER BY date DESC
  `).all();

  res.json({
    totalUsers,
    totalMessages,
    bannedUsers,
    todayMessages,
    messagesPerDay
  });
});

// Banir usuário
app.post('/api/admin/ban', adminMiddleware, (req, res) => {
  const { email } = req.body;
  db.prepare('INSERT OR IGNORE INTO banned_users (email, banned_at) VALUES (?, ?)').run(email, new Date().toISOString());
  db.prepare('UPDATE users SET banned = 1 WHERE email = ?').run(email);
  res.json({ success: true });
});

// Desbanir usuário
app.post('/api/admin/unban', adminMiddleware, (req, res) => {
  const { email } = req.body;
  db.prepare('DELETE FROM banned_users WHERE email = ?').run(email);
  db.prepare('UPDATE users SET banned = 0 WHERE email = ?').run(email);
  res.json({ success: true });
});

// Apagar histórico de usuário
app.delete('/api/admin/users/:id/historico', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM messages WHERE user_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== ROTA PRINCIPAL =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== INICIAR =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Kryno IA rodando na porta ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});
