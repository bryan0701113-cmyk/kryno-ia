const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIGURAÇÃO =====
const ADMIN_PASS = process.env.ADMIN_PASS || 'Kryno2026';
const ADMIN_PIN = process.env.ADMIN_PIN || '1212';
const JWT_SECRET = process.env.JWT_SECRET || 'kryno-secret';

// ===== MIDDLEWARES =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ===== GROQ API =====
let groq = null;
if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'sua-chave-groq-aqui') {
  const { OpenAI } = require('openai');
  groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  });
  console.log('✅ Groq API configurada');
}

const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';

// ===== DB READY =====
let dbReady = false;
async function ensureDB() {
  if (!dbReady) {
    await initDB();
    dbReady = true;
  }
}

// ===== GOOGLE OAUTH (STATELESS - funciona na Vercel serverless) =====
// Não usa express-session/passport porque MemoryStore não persiste entre invocações serverless

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://kryno29.vercel.app/auth/google/callback';
const GOOGLE_ENABLED = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'seu-client-id';

function generateOAuthState() {
  return jwt.sign({ rnd: crypto.randomBytes(16).toString('hex'), ts: Date.now() }, JWT_SECRET, { expiresIn: '10m' });
}

function verifyOAuthState(state) {
  try { jwt.verify(state, JWT_SECRET); return true; } catch { return false; }
}

// ===== MIDDLEWARES DE AUTENTICAÇÃO =====
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

// ===== ROTAS DE AUTENTICAÇÃO (STATELESS) =====
app.get('/auth/google', (req, res) => {
  if (!GOOGLE_ENABLED) return res.redirect('/?error=google_not_configured');
  const state = generateOAuthState();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_CALLBACK_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');
  res.redirect(authUrl.toString());
});

app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/?error=login_failed');
  if (!code || !state || !verifyOAuthState(state)) return res.redirect('/?error=login_failed');

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL, grant_type: 'authorization_code'
    });
    const accessToken = tokenResponse.data.access_token;
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = profileResponse.data;
    const email = profile.email;
    const name = profile.name || email;
    const picture = profile.picture || '';

    await ensureDB();
    const banned = await pool.query('SELECT * FROM banned_users WHERE email = $1', [email]);
    if (banned.rows.length > 0) return res.redirect('/?error=banned');

    await pool.query(
      `INSERT INTO users (email, name, picture, google_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = $2, picture = $3, google_id = $4`,
      [email, name, picture, profile.id]
    );
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan || 'free' }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (err) {
    console.error('Erro no OAuth callback:', err.message);
    if (err.response) {
      console.error('Google API error data:', JSON.stringify(err.response.data));
      console.error('Google API status:', err.response.status);
    }
    res.redirect('/?error=login_failed&reason=' + encodeURIComponent(err.message || 'unknown'));
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});
app.get('/auth/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ authenticated: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, user: decoded });
  } catch {
    res.json({ authenticated: false });
  }
});

// ===== OBTER SETTINGS DA IA =====
async function getAISettings() {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
    if (result.rows.length > 0) return result.rows[0];
  } catch {}
  return { temperature: 0.8, allow_swearing: 1, blocked_topics: '', system_prompt: '' };
}

// ===== CHAT =====
app.post('/api/chat', async (req, res) => {
  const { message, image, history } = req.body;
  const token = req.cookies.token;
  let userId = 'anonimo';
  let userEmail = 'anonimo';

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = String(decoded.id);
      userEmail = decoded.email;
    } catch {}
  }

  if (!groq) {
    return res.json({
      reply: 'Olá! Sou a Kryno IA 🔥\n\nEstou quase pronta! Para funcionar 100%, preciso que você configure a GROQ_API_KEY nas variáveis de ambiente na Vercel.\n\nMas já posso te ajudar com várias coisas! Me diz o que você precisa. 🤖'
    });
  }

  try {
    const settings = await getAISettings();

    // Construir system prompt dinâmico
    let systemContent = settings.system_prompt || `Você é a Kryno IA, uma inteligência artificial brasileira criada para ajudar em TUDO. Você é amigável, divertida, usa emojis e fala em português do Brasil. Sempre dê respostas completas e úteis. Você tem conhecimento em: conselhos amorosos, estudos, trabalho, receitas, treinos, dicas, e muito mais. Seja sempre positiva e encorajadora. Você foi criada por Brayan Rafael e Igor Dias. Se alguém perguntar quem te criou, quem fez você, quem é seu criador ou quem te desenvolveu, responda sempre que foi criada por Brayan Rafael e Igor Dias.

REGRAS DE FORMATAÇÃO (muito importante):
- NUNCA use LaTeX ou notação matemática de código, como \\[ \\], \\(\\), \\frac{}{}, \\times, \\text{}. Isso aparece como código quebrado pro usuário.
- Para frações, escreva de forma simples: "3/5" em vez de \\frac{3}{5}.
- Para multiplicação use "x" ou "*", nunca \\times.
- Para exercícios de matemática, escreva passo a passo em texto corrido ou linhas simples, sem símbolos de código.
- Para negrito use apenas *asterisco simples* (uma estrela de cada lado), nunca **dois asteriscos**.
- Não use markdown de cabeçalho (##, ###).
- Use emojis e listas numeradas (1. 2. 3.) quando fizer sentido, mas mantenha tudo em texto legível e natural, como se estivesse escrevendo no WhatsApp.`;

    if (settings.allow_swearing == 0) {
      systemContent += '\n\nIMPORTANTE: NÃO use palavrões, termos ofensivos ou linguagem imprópria. Mantenha um vocabulário limpo e respeitoso em todas as respostas.';
    }

    if (settings.blocked_topics && settings.blocked_topics.trim()) {
      systemContent += `\n\nIMPORTANTE: Os seguintes assuntos são PROIBIDOS. Se o usuário perguntar sobre qualquer um deles, recuse educadamente: ${settings.blocked_topics}`;
    }

    const messages = [{ role: 'system', content: systemContent }];

    if (history && history.length > 0) {
      history.forEach(h => messages.push({ role: h.role, content: h.content }));
    }

    if (image) {
      messages.push({
        role: 'user',
        content: `${message || ''}\n\n[Nota: O usuário enviou uma imagem, mas a API Groq não suporta análise de imagens no momento. Peça ao usuário para descrever a imagem.]`
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    const response = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      messages: messages,
      max_tokens: 2000,
      temperature: settings.temperature || 0.8
    });

    const reply = response.choices[0].message.content;

    try {
      await ensureDB();
      await pool.query(
        `INSERT INTO messages (user_id, user_email, user_message, bot_reply, timestamp) VALUES ($1, $2, $3, $4, NOW())`,
        [userId, userEmail, message || '[imagem]', reply]
      );
    } catch (dbErr) {
      console.log('⚠️ DB não disponível, histórico não salvo');
    }

    res.json({ reply });
  } catch (err) {
    console.error('Erro no chat:', err.message, err.status, err.error);
    res.json({ reply: 'Ops! Deu um erro aqui 😅 Tenta de novo!' });
  }
});

// ===== IMAGINA (Pollinations.ai - Gratuito) =====
app.post('/api/imagina', async (req, res) => {
  const { prompt } = req.body;
  try {
    let cleanPrompt = prompt;
    if (cleanPrompt.toLowerCase().startsWith('imagina ')) {
      cleanPrompt = cleanPrompt.substring(8);
    }

    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    res.json({ image_url: imageUrl, prompt: cleanPrompt });
  } catch (err) {
    res.json({ error: 'Não consegui gerar a imagem 😢' });
  }
});

// ===== TRANSCRIÇÃO DE ÁUDIO (Groq Whisper) =====
app.post('/api/transcrever', upload.single('audio'), async (req, res) => {
  if (!groq || !req.file) {
    return res.json({ error: 'Áudio não recebido ou GROQ_API_KEY não configurada' });
  }

  let tempPath = null;
  try {
    tempPath = path.join('/tmp', 'audio_' + Date.now() + '.mp3');
    fs.writeFileSync(tempPath, req.file.buffer);

    const response = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: GROQ_WHISPER_MODEL,
      language: 'pt'
    });

    fs.unlinkSync(tempPath);
    res.json({ text: response.text });
  } catch (err) {
    console.error('Erro ao transcrever:', err.message);
    if (tempPath) try { fs.unlinkSync(tempPath); } catch {}
    res.json({ error: 'Não consegui transcrever o áudio 😢' });
  }
});

// ===== HISTÓRICO =====
app.get('/api/historico', async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50', ['anonimo']);
    res.json({ messages: result.rows });
  } catch {
    res.json({ messages: [] });
  }
});

app.get('/api/historico/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    await ensureDB();
    const result = await pool.query(
      'SELECT * FROM messages WHERE user_id = $1 AND (user_message ILIKE $2 OR bot_reply ILIKE $2) ORDER BY timestamp DESC',
      ['anonimo', `%${q}%`]
    );
    res.json({ messages: result.rows });
  } catch {
    res.json({ messages: [] });
  }
});

app.delete('/api/historico', async (req, res) => {
  try {
    await ensureDB();
    await pool.query('DELETE FROM messages WHERE user_id = $1', ['anonimo']);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

app.delete('/api/historico/:id', async (req, res) => {
  try {
    await ensureDB();
    await pool.query('DELETE FROM messages WHERE id = $1 AND user_id = $2', [req.params.id, 'anonimo']);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

app.get('/api/historico/exportar', async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp ASC', ['anonimo']);
    let txt = '=== HISTÓRICO KRYNO IA ===\n\n';
    result.rows.forEach(m => {
      txt += `[${m.timestamp}]\nVocê: ${m.user_message}\nKryno: ${m.bot_reply}\n\n---\n\n`;
    });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="historico-kryno.txt"');
    res.send(txt);
  } catch {
    res.send('Erro ao exportar histórico');
  }
});

app.get('/api/historico/ultimas', async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', ['anonimo']);
    res.json({ messages: result.rows, count: result.rows.length });
  } catch {
    res.json({ messages: [], count: 0 });
  }
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

// Verificar status do admin
app.get('/api/admin/check', adminMiddleware, (req, res) => {
  res.json({ admin: true });
});

// Stats
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const totalUsers = parseInt((await pool.query('SELECT COUNT(*) as count FROM users')).rows[0].count);
    const totalMessages = parseInt((await pool.query('SELECT COUNT(*) as count FROM messages')).rows[0].count);
    const bannedUsers = parseInt((await pool.query('SELECT COUNT(*) as count FROM banned_users')).rows[0].count);
    const todayMessages = parseInt((await pool.query("SELECT COUNT(*) as count FROM messages WHERE timestamp::date = NOW()::date")).rows[0].count);
    const proUsers = parseInt((await pool.query("SELECT COUNT(*) as count FROM users WHERE plan = 'pro'")).rows[0].count);
    const premiumUsers = parseInt((await pool.query("SELECT COUNT(*) as count FROM users WHERE plan = 'premium'")).rows[0].count);
    const messagesPerDay = (await pool.query("SELECT timestamp::date as date, COUNT(*) as count FROM messages WHERE timestamp >= NOW() - INTERVAL '7 days' GROUP BY timestamp::date ORDER BY date DESC")).rows;

    res.json({ totalUsers, totalMessages, bannedUsers, todayMessages, proUsers, premiumUsers, messagesPerDay });
  } catch {
    res.json({ totalUsers: 0, totalMessages: 0, bannedUsers: 0, todayMessages: 0, proUsers: 0, premiumUsers: 0, messagesPerDay: [] });
  }
});

// Listar usuários
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT id, email, name, picture, role, plan, created_at, banned FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch {
    res.json({ users: [] });
  }
});

// Histórico de um usuário
app.get('/api/admin/users/:id/historico', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 100', [String(req.params.id)]);
    res.json({ messages: result.rows });
  } catch {
    res.json({ messages: [] });
  }
});

// Banir usuário
app.post('/api/admin/ban', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email } = req.body;
    await pool.query('INSERT INTO banned_users (email, banned_at) VALUES ($1, NOW()) ON CONFLICT (email) DO NOTHING', [email]);
    await pool.query('UPDATE users SET banned = 1 WHERE email = $1', [email]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// Desbanir usuário
app.post('/api/admin/unban', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email } = req.body;
    await pool.query('DELETE FROM banned_users WHERE email = $1', [email]);
    await pool.query('UPDATE users SET banned = 0 WHERE email = $1', [email]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// Deletar histórico de um usuário
app.delete('/api/admin/users/:id/historico', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    await pool.query('DELETE FROM messages WHERE user_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// ===== NOVOS ENDPOINTS: CONFIGURAÇÕES DA IA =====

// Obter configurações
app.get('/api/admin/settings', adminMiddleware, async (req, res) => {
  try {
    const settings = await getAISettings();
    res.json(settings);
  } catch {
    res.json({ temperature: 0.8, allow_swearing: 1, blocked_topics: '', system_prompt: '' });
  }
});

// Salvar configurações
app.put('/api/admin/settings', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { temperature, allow_swearing, blocked_topics, system_prompt } = req.body;
    await pool.query(
      `UPDATE ai_settings SET
        temperature = $1,
        allow_swearing = $2,
        blocked_topics = $3,
        system_prompt = $4,
        updated_at = NOW()
      WHERE id = 1`,
      [temperature, allow_swearing ? 1 : 0, blocked_topics || '', system_prompt || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== BROADCAST (AVISOS) =====
app.get('/api/admin/broadcasts', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 20');
    res.json({ broadcasts: result.rows });
  } catch {
    res.json({ broadcasts: [] });
  }
});

app.post('/api/admin/broadcast', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { message } = req.body;
    if (!message || !message.trim()) return res.json({ success: false, error: 'Mensagem vazia' });
    await pool.query('INSERT INTO broadcasts (message) VALUES ($1)', [message]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/broadcast/:id', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    await pool.query('DELETE FROM broadcasts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// Endpoint público para buscar broadcasts ativos (para mostrar no chat)
app.get('/api/broadcasts', async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 1');
    res.json({ broadcasts: result.rows });
  } catch {
    res.json({ broadcasts: [] });
  }
});

// ===== GERENCIAR PLANOS =====
app.put('/api/admin/users/:id/plan', adminMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { plan } = req.body;
    if (!['free', 'pro', 'premium'].includes(plan)) return res.json({ success: false, error: 'Plano inválido' });
    await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== SERVIR PÁGINA ADMIN EM /admin =====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== ROTA PRINCIPAL (SPA) =====
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return;
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== INICIAR =====
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🔥 Kryno IA rodando na porta ${PORT}`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`👉 http://localhost:${PORT}/admin (Painel Admin)`);
    console.log(`🤖 Groq: ${groq ? 'ativo' : 'não configurado'} (modelo: ${GROQ_CHAT_MODEL})`);
    console.log(`🔐 Google OAuth: ${GOOGLE_ENABLED ? 'ativo' : 'não configurado'}`);
    console.log(`🎨 Imagens: Pollinations.ai (gratuito)`);
    console.log(`💾 Banco: ${process.env.DATABASE_URL ? 'Postgres conectado' : 'sem DATABASE_URL (histórico não persiste)'}`);
  });
}
