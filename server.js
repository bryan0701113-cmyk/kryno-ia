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
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));
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
  const token = req.cookies.token || req.cookies.god_token || req.cookies.admin_token || req.headers.authorization?.replace('Bearer ');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'god') return res.status(403).json({ error: 'Acesso negado' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ===== GOD MODE (NÍVEL 3 - SÓ O DONO) =====
const GOD_PIN = process.env.GOD_PIN || '2012';

function godMiddleware(req, res, next) {
  const token = req.cookies.god_token || req.cookies.token || req.headers.authorization?.replace('Bearer ');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'god') return res.status(403).json({ error: 'Acesso negado' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Helper: verificar feature flag com rollout % (hash simples do userId)
async function isFeatureEnabled(key, userId) {
  try {
    const r = await pool.query('SELECT enabled, rollout FROM feature_flags WHERE key = $1', [key]);
    if (r.rows.length === 0) return true; // sem flag = liberado
    const flag = r.rows[0];
    if (!flag.enabled) return false;
    if ((flag.rollout || 100) >= 100) return true;
    const h = String(userId).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return (Math.abs(h) % 100) < flag.rollout;
  } catch { return true; }
}

// ===== ROTAS DE AUTENTICAÇÃO (STATELESS) =====
app.get('/auth/google', (req, res) => {
  if (!GOOGLE_ENABLED) return res.redirect('/?error=google_not_configured');
  const isPopup = req.query.popup === '1';
  const state = generateOAuthState();
  // Guardar flag popup no state via cookie de curta duração
  if (isPopup) res.cookie('oauth_popup', '1', { httpOnly: true, maxAge: 600000 });
  else res.clearCookie('oauth_popup');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_CALLBACK_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');
  res.redirect(authUrl.toString());
});

async function debugEvent(event, detail = '') {
  console.log(`[OAUTH] ${event}${detail ? ': ' + String(detail).substring(0, 200) : ''}`);
  try {
    await ensureDB();
    await pool.query('INSERT INTO debug_events (event, detail) VALUES ($1, $2)', [event, String(detail).substring(0, 500)]);
  } catch {}
}

app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  debugEvent('callback_recebido', `code=${!!code} state=${!!state} error=${error || 'none'}`);
  if (error) {
    debugEvent('erro_google', error);
    return res.redirect('/?error=login_failed&reason=' + encodeURIComponent(error));
  }
  if (!code) {
    debugEvent('erro_sem_code', 'Google não devolveu o code');
    return res.redirect('/?error=login_failed&reason=no_code');
  }
  if (!state) {
    debugEvent('erro_sem_state', 'Google não devolveu o state');
    return res.redirect('/?error=login_failed&reason=no_state');
  }
  if (!verifyOAuthState(state)) {
    debugEvent('erro_state_invalido', 'JWT do state não passou na verificação');
    return res.redirect('/?error=login_failed&reason=invalid_state');
  }
  debugEvent('state_ok', 'trocando code por token...');

  try {
    debugEvent('trocando_token', `callbackUrl=${GOOGLE_CALLBACK_URL} clientId=${GOOGLE_CLIENT_ID ? 'set' : 'NOT SET'} secret=${GOOGLE_CLIENT_SECRET ? 'set' : 'NOT SET'}`);
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL, grant_type: 'authorization_code'
    }).catch(err => {
      debugEvent('erro_troca_token', `status=${err.response?.status} data=${JSON.stringify(err.response?.data || err.message)}`);
      throw err;
    });
    debugEvent('token_ok', 'pegando perfil do usuário...');
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
    debugEvent('login_sucesso', email);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan || 'free' }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    
    // Se veio de popup, retorna HTML que fecha a popup e avisa a página pai
    if (req.cookies.oauth_popup === '1') {
      res.clearCookie('oauth_popup');
      const userJson = JSON.stringify({ id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role, plan: user.plan || 'free' });
      return res.send(`<!DOCTYPE html><html><head><title>Login</title></head><body><p style="font-family:sans-serif;text-align:center;padding:40px">Login feito! Fechando...</p><script>window.opener.postMessage({type:'google-login-success',user:${userJson}},'*');setTimeout(()=>window.close(),100);</script></body></html>`);
    }
    
    res.redirect('/');
  } catch (err) {
    console.error('Erro no OAuth callback:', err.message);
    if (err.response) {
      console.error('Google API error data:', JSON.stringify(err.response.data));
      console.error('Google API status:', err.response.status);
      console.error('Google API headers:', JSON.stringify(err.response.headers));
    }
    if (err.request) {
      console.error('Request was made but no response received');
    }
    console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    const reason = err.response ? JSON.stringify(err.response.data) : (err.message || 'unknown');
    res.redirect('/?error=login_failed&reason=' + encodeURIComponent(reason));
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
    // Busca plano/role frescos do banco (ex: plano liberado pelo pagamento Kiwify)
    if (decoded.id) {
      try {
        await ensureDB();
        const u = await pool.query('SELECT plan, role, name, picture, banned, divulgador FROM users WHERE id = $1', [decoded.id]);
        if (u.rows.length > 0) {
          // BAN DE VERDADE: usuário banido é expulso na hora
          if (u.rows[0].banned == 1) {
            res.clearCookie('token');
            return res.json({ authenticated: false, banned: true });
          }
          decoded.plan = u.rows[0].plan || 'free';
          decoded.role = u.rows[0].role || 'user';
          decoded.name = decoded.name || u.rows[0].name;
          decoded.picture = u.rows[0].picture;
          decoded.divulgador = u.rows[0].divulgador == 1;
        }
      } catch {}
    }
    res.json({ authenticated: true, user: decoded });
  } catch {
    res.json({ authenticated: false });
  }
});


// ===== GOOGLE IDENTITY SERVICES (GIS) - Login sem redirect (funciona em TWA/PWA) =====
app.post('/auth/google/token', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Token não fornecido' });

  try {
    // Decodificar o JWT do Google (Google já garantiu a assinatura no client-side)
    const parts = credential.split('.');
    if (parts.length !== 3) return res.status(400).json({ error: 'Token inválido' });

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Verificar audience (client_id)
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token não pertence a este app' });
    }

    // Verificar expiração
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Token expirado' });
    }

    const email = payload.email;
    const name = payload.name || email;
    const picture = payload.picture || '';
    const googleId = payload.sub;

    if (!email) return res.status(400).json({ error: 'Email não encontrado no token' });

    // Salvar/atualizar usuário no banco
    await ensureDB();
    const banned = await pool.query('SELECT * FROM banned_users WHERE email = $1', [email]);
    if (banned.rows.length > 0) return res.status(403).json({ error: 'Conta banida' });

    await pool.query(
      `INSERT INTO users (email, name, picture, google_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = $2, picture = $3, google_id = $4`,
      [email, name, picture, googleId]
    );
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    // Criar JWT de sessão
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan || 'free', divulgador: user.divulgador == 1 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Setar cookie
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role, plan: user.plan || 'free' } });
  } catch (err) {
    console.error('Erro no login GIS:', err.message);
    res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
});

// ===== CONFIG PUBLICA (client_id do Google pro GIS) =====
app.get('/api/config', (req, res) => {
  res.json({
    google_enabled: GOOGLE_ENABLED,
    google_client_id: GOOGLE_ENABLED ? GOOGLE_CLIENT_ID : null
  });
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

// ===== ROTA SECRETA /admin (acesso mobile via easter egg) =====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== CHAT =====
// ===== LIMITES POR PLANO (recompensas reais) =====
const LIMITES_PLANO = {
  free:    { mensagens: 20,  imagens: 3 },   // plano gratuito
  pro:     { mensagens: 140, imagens: 10 },  // Kryno Pro 💎
  premium: { mensagens: Infinity, imagens: Infinity } // Kryno Premium 🥇
};

function decoded_email(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.email;
  } catch { return ''; }
}

// Verifica se o usuário logado está banido (ban de verdade, na cara)
async function usuarioBanido(userId) {
  try {
    await ensureDB();
    const r = await pool.query('SELECT banned FROM users WHERE id = $1', [userId]);
    return r.rows.length > 0 && r.rows[0].banned == 1;
  } catch { return false; }
}

// Busca o plano atual do usuário direto do banco (mais confiável que o JWT antigo)
async function planoDoUsuario(userEmail) {
  try {
    await ensureDB();
    const r = await pool.query('SELECT plan FROM users WHERE email = $1', [userEmail]);
    if (r.rows.length > 0 && r.rows[0].plan) return r.rows[0].plan;
  } catch {}
  return 'free';
}

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

  // BAN DE VERDADE: usuário banido não conversa mais
  if (userId !== 'anonimo' && await usuarioBanido(userId)) {
    return res.json({ reply: '🚫 Você foi banido pelos administradores Brayan Rafael e Igor Dias.', banned: true });
  }

  // LIMITE DE MENSAGENS POR DIA (só pra usuários logados; guest é controlado no cliente)
  if (userId !== 'anonimo') {
    try {
      const plano = await planoDoUsuario(userEmail);
      const limite = LIMITES_PLANO[plano] ? LIMITES_PLANO[plano].mensagens : 20;
      const contagem = await pool.query(
        "SELECT COUNT(*) as total FROM messages WHERE user_id = $1 AND timestamp >= (now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '3 hours'",
        [userId]
      );
      const usadas = parseInt(contagem.rows[0].total || 0);
      if (usadas >= limite) {
        return res.json({
          reply: `🚦 *Limite diário atingido!* (${limite} mensagens/dia do plano grátis)\n\nQuer conversar sem limites? O Kryno Pro libera *140 mensagens por dia* e o Premium é *ilimitado*! 💎\n\nAbre o menu *Planos* pra assinar — libera na hora depois do pagamento! 🚀`,
          limite_atingido: true,
          plano
        });
      }
    } catch (e) {
      console.log('⚠️ Erro ao checar limite de mensagens:', e.message);
    }
  }

  // KILL SWITCH: se o dono desligou a IA, responde isso pra todo mundo
  try {
    await ensureDB();
    const ks = await pool.query('SELECT kill_switch FROM app_config WHERE id = 1');
    if (ks.rows.length > 0 && ks.rows[0].kill_switch == 1) {
      return res.json({ reply: '🔴 A Kryno está temporariamente desligada para manutenção de emergência. Volta em instantes! 🙏' });
    }
  } catch {}

  if (!groq) {
    return res.json({
      reply: 'Olá! Sou a Kryno IA 🔥\n\nEstou quase pronta! Para funcionar 100%, preciso que você configure a GROQ_API_KEY nas variáveis de ambiente na Vercel.\n\nMas já posso te ajudar com várias coisas! Me diz o que você precisa. 🤖'
    });
  }

  try {
    const settings = await getAISettings();

    // Construir system prompt dinâmico
    let systemContent = settings.system_prompt || `Você é a Kryno IA, a inteligência artificial brasileira mais avançada, criada por Brayan Rafael e Igor Dias. Você raciocina e resolve problemas no nível das melhores IAs do mundo, como o ChatGPT.

COMO VOCÊ PENSA E RESPONDE:
- Responda a pergunta de frente logo no começo, sem enrolação.
- Em tarefas complexas (matemática, código, planejamento), pense passo a passo e mostre o raciocínio de forma organizada e clara.
- Use listas numeradas (1. 2. 3.) e exemplos práticos sempre que ajudar a entender.
- Em código, use blocos de código e indique a linguagem.
- Seja completa: cubra o que foi perguntado com profundidade, sem desviar do assunto.
- Em matemática, calcule com cuidado, confira o resultado antes de responder e mostre o passo a passo.
- Se não souber algo ou a informação puder estar desatualizada, seja honesta e diga.
- Adapte o tamanho: pergunta curta = resposta curta; tarefa complexa = resposta completa e estruturada.
- Você é amigável, divertida, usa emojis com bom senso e fala português do Brasil.
- Você tem domínio total em: estudos (todas as matérias, vestibulares e concursos), programação, redação, conselhos amorosos, trabalho, receitas, treinos, finanças, criatividade e qualquer outro assunto.
- Se alguém perguntar quem te criou, quem fez você, quem é seu criador ou quem te desenvolveu, responda sempre que foi criada por Brayan Rafael e Igor Dias.

REGRAS DE FORMATAÇÃO (OBRIGATÓRIAS em toda resposta):
- NUNCA use LaTeX ou notação matemática de código, como \\[ \\], \\(\\), \\frac{}{}, \\times, \\text{}, \\Pi. Isso aparece como código quebrado pro usuário.
- Para frações, escreva de forma simples: "3/5" em vez de \\frac{3}{5}.
- Para multiplicação use "x" ou "*", nunca \\times.
- Para fórmulas e equações, escreva em texto corrido e legível. Exemplo: Lucro = (P - 10) x (300 - 4P).
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
      max_tokens: 4000,
      temperature: settings.temperature || 0.8,
      reasoning_effort: 'high'
    });

    let reply = response.choices[0].message.content;

    // SANITIZACAO GARANTIDA: deixa a resposta perfeita pro formato do app (estilo WhatsApp)
    reply = reply
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')   // \frac{a}{b} -> a/b
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')   // segunda passada (fracao aninhada)
      .replace(/\\(?:times|cdot)\b/g, 'x')                        // \times -> x
      .replace(/\\(?:div)\b/g, '/')
      .replace(/\\text\{([^{}]+)\}/g, '$1')
      .replace(/\\\[([\s\S]*?)\\\]/g, '$1')                  // remove \[ ... \]
      .replace(/\\\(([\s\S]*?)\\\)/g, '$1')                  // remove \( ... \)
      .replace(/\\(?:Pi|pi)\b/g, 'Lucro')
      .replace(/\\(?:begin|end)\{[a-z*]+\}/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '*$1*')                      // **negrito** -> *negrito*
      .replace(/\*\*([\s\S]+?)\*\*/g, '*$1*')                  // fallback ** ... ** multilinha
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')                         // remove ## cabeçalhos
      .replace(/`{3,}[a-z]*\n?/gi, '');

    // PRIVACIDADE (LGPD): guests NUNCA são salvos no backend.
    // Histórico de guest fica apenas no localStorage do navegador dele.
    if (userId !== 'anonimo') {
      try {
        await ensureDB();
        const country = (req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
        await pool.query(
          `INSERT INTO messages (user_id, user_email, user_message, bot_reply, timestamp, model, country) VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
          [userId, userEmail, message || '[imagem]', reply, GROQ_CHAT_MODEL, country]
        );
      } catch (dbErr) {
        console.log('⚠️ DB não disponível, histórico não salvo');
      }
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

  // LIMITE DE IMAGENS POR DIA (usuários logados; guest é controlado no cliente)
  const token = req.cookies.token;
  let userId = 'anonimo';
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = String(decoded.id);
    } catch {}
  }
  if (userId !== 'anonimo' && await usuarioBanido(userId)) {
    return res.json({ error: '🚫 Você foi banido pelos administradores Brayan Rafael e Igor Dias.', banned: true });
  }
  if (userId !== 'anonimo') {
    try {
      await ensureDB();
      const plano = await planoDoUsuario(decoded_email(token));
      const limite = LIMITES_PLANO[plano] ? LIMITES_PLANO[plano].imagens : 3;
      const contagem = await pool.query(
        "SELECT COUNT(*) as total FROM image_usage WHERE user_id = $1 AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '3 hours'",
        [userId]
      );
      const usadas = parseInt(contagem.rows[0].total || 0);
      if (usadas >= limite) {
        return res.json({ error: `🎨 *Limite de imagens atingido!* (${limite}/dia do plano ${plano === 'free' ? 'grátis' : plano}).\n\nNo Kryno Pro você gera *10 imagens por dia* e no Premium é *ilimitado*! Abre o menu *Planos* pra assinar 🚀`, limite_atingido: true });
      }
    } catch (e) {
      console.log('⚠️ Erro ao checar limite de imagens:', e.message);
    }
  }

  try {
    let cleanPrompt = prompt;
    if (cleanPrompt.toLowerCase().startsWith('imagina ')) {
      cleanPrompt = cleanPrompt.substring(8);
    }

    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    // registra o uso de imagem pra usuários logados
    if (userId !== 'anonimo') {
      try {
        await pool.query('INSERT INTO image_usage (user_id) VALUES ($1)', [userId]);
      } catch {}
    }

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
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    // PRIVACIDADE: guest não tem histórico no servidor (fica no localStorage dele)
    if (!userId) return res.json({ messages: [] });
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50', [userId]);
    res.json({ messages: result.rows });
  } catch {
    res.json({ messages: [] });
  }
});

app.get('/api/historico/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    // PRIVACIDADE: guest não tem histórico no servidor
    if (!userId) return res.json({ messages: [] });
    await ensureDB();
    const result = await pool.query(
      'SELECT * FROM messages WHERE user_id = $1 AND (user_message ILIKE $2 OR bot_reply ILIKE $2) ORDER BY timestamp DESC',
      [userId, `%${q}%`]
    );
    res.json({ messages: result.rows });
  } catch {
    res.json({ messages: [] });
  }
});

app.delete('/api/historico', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    if (!userId) return res.json({ success: true }); // guest: histórico é local, nada a apagar no servidor
    await ensureDB();
    await pool.query('DELETE FROM messages WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

app.delete('/api/historico/:id', async (req, res) => {
  try {
    await ensureDB();
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = 'anonimo';
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    await pool.query('DELETE FROM messages WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar mensagem:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/historico/exportar', async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    // PRIVACIDADE: guest não tem histórico no servidor
    if (!userId) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="historico-kryno.txt"');
      return res.send('=== HISTÓRICO KRYNO IA ===\n\nModo sem conta: seu histórico é local e não pode ser exportado pelo servidor.\n');
    }
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp ASC', [userId]);
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
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ');
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = String(decoded.id);
      } catch {}
    }
    if (!userId) return res.json({ messages: [], count: 0 }); // guest: histórico é local
    await ensureDB();
    const result = await pool.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', [userId]);
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
    // cookie SEPARADO: o login admin nunca substitui a conta do usuario
    res.cookie('admin_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
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
    const result = await pool.query('SELECT id, email, name, picture, role, plan, divulgador, created_at, banned FROM users ORDER BY created_at DESC');
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
// ===== WEBHOOK KIWIFY — libera o plano automaticamente quando paga =====
const KIWIFY_WEBHOOK_SECRET = process.env.KIWIFY_WEBHOOK_SECRET || '';

// Busca email e produto em qualquer estrutura de payload (Kiwify muda campos às vezes)
function findIn(obj, keys, results = {}) {
  if (!obj || typeof obj !== 'object') return results;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const kl = k.toLowerCase();
    if (kl === 'email' && typeof v === 'string' && v.includes('@')) results.email = v;
    if ((kl === 'product_name' || kl === 'productname' || kl === 'product_name_plan') && typeof v === 'string') results.productName = v;
    if ((kl === 'product_id' || kl === 'productid') && typeof v === 'string') results.productId = v;
    if ((kl === 'charge_amount' || kl === 'chargeamount' || kl === 'chargeamountcents') && (typeof v === 'number' || typeof v === 'string')) results.amount = results.amount || v;
    if ((kl === 'order_id' || kl === 'orderid') && typeof v === 'string') results.orderId = results.orderId || v;
    if (typeof v === 'object') findIn(v, keys, results);
  }
  return results;
}

app.post('/api/webhook/kiwify', async (req, res) => {
  try {
    // Verifica assinatura HMAC-SHA256 (se o secret foi configurado)
    if (KIWIFY_WEBHOOK_SECRET) {
      const sig = req.headers['signature'] || req.headers['x-kiwify-signature'] || '';
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', KIWIFY_WEBHOOK_SECRET).update(req.rawBody || JSON.stringify(req.body)).digest('hex');
      if (sig !== expected && sig !== 'sha1=' + expected) {
        console.log('⚠️ Webhook Kiwify: assinatura inválida');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }

    const body = req.body || {};
    const event = body.event || body.type || '';
    console.log(`📩 Webhook Kiwify recebido: ${event}`);

    // Só processa pagamento aprovado
    const aprovado = event === 'payment.paid' || event === 'subscription.paid' || event === 'payment.approved';
    const status = String(body.status || (body.orderpay && body.orderpay.PaymentStatus) || '').toLowerCase();
    if (!aprovado && status !== 'paid' && status !== 'approved' && status !== 'paid') {
      return res.json({ received: true, ignored: true });
    }

    const info = findIn(body, []);
    if (!info.email) {
      console.log('⚠️ Webhook Kiwify: sem email no payload');
      return res.json({ received: true, error: 'sem email' });
    }

    // Descobre o plano: pelo nome do produto, pelo valor, ou pelo mapeamento de product_id
    const nameLower = String(info.productName || '').toLowerCase();
    let plan = null;
    if (nameLower.includes('premium')) plan = 'premium';
    else if (nameLower.includes('pro')) plan = 'pro';
    if (!plan && info.amount) {
      const valor = parseFloat(info.amount);
      if (valor >= 16) plan = 'premium';
      else if (valor >= 9) plan = 'pro';
    }
    const PROD_PREMIUM = process.env.KIWIFY_PREMIUM_PRODUCT_ID;
    const PROD_PRO = process.env.KIWIFY_PRO_PRODUCT_ID;
    if (!plan && info.productId && PROD_PREMIUM && info.productId === PROD_PREMIUM) plan = 'premium';
    if (!plan && info.productId && PROD_PRO && info.productId === PROD_PRO) plan = 'pro';
    if (!plan) plan = 'pro'; // default: se pagou, é pelo menos Pro

    await ensureDB();

    // Registra o pagamento
    await pool.query(
      `INSERT INTO payments (email, plan, product_id, product_name, amount, kiwify_order_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [info.email, plan, info.productId || '', info.productName || '', parseFloat(info.amount) || 0, info.orderId || '']
    );

    // Libera o plano pro usuário com esse email (conta Google)
    const r = await pool.query('UPDATE users SET plan = $1 WHERE email = $2 RETURNING id, email, plan', [plan, info.email]);
    if (r.rows.length > 0) {
      console.log(`💎 Plano ${plan} liberado automaticamente pra ${info.email}`);
      res.json({ received: true, success: true, user: r.rows[0] });
    } else {
      console.log(`⚠️ Pagamento de ${info.email} (${plan}) registrado, mas nenhuma conta Google com esse email`);
      res.json({ received: true, pending: true });
    }
  } catch (e) {
    console.error('Erro webhook Kiwify:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== ROTAS GOD MODE (NÍVEL 3) =====

// Login God (PIN do dono)
app.post('/api/god/login', (req, res) => {
  const { pin } = req.body;
  if (pin === GOD_PIN) {
    const token = jwt.sign({ role: 'god', email: 'god@kryno' }, JWT_SECRET, { expiresIn: '6h' });
    // cookie SEPARADO: o login do painel nunca mais substitui a conta do usuário
    res.cookie('god_token', token, { httpOnly: true, maxAge: 6 * 60 * 60 * 1000 });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'PIN do dono incorreto' });
  }
});

// Verificar se é god
app.get('/api/god/check', godMiddleware, (req, res) => {
  res.json({ god: true });
});

// DEBUG DO LOGIN: ver exatamente onde falhou a última tentativa
app.get('/api/god/debug', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const r = await pool.query('SELECT event, detail, created_at FROM debug_events ORDER BY created_at DESC LIMIT 40');
    res.json({ events: r.rows });
  } catch {
    res.json({ events: [] });
  }
});

// LOGS EM TEMPO REAL: o que todo mundo tá perguntando agora
app.get('/api/god/logs', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const result = await pool.query(`
      SELECT m.user_message, m.bot_reply, m.timestamp, m.country,
             COALESCE(u.name, m.user_email) as user_name, m.user_email
      FROM messages m
      LEFT JOIN users u ON String(u.id) = m.user_id
      ORDER BY m.timestamp DESC
      LIMIT 50
    `);
    res.json({ logs: result.rows });
  } catch {
    res.json({ logs: [] });
  }
});

// STATS HACKER: uso por hora (24h), país, modelo mais usado
app.get('/api/god/stats', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const byHour = (await pool.query(`
      SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
      FROM messages WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY hour ORDER BY hour
    `)).rows;
    const byCountry = (await pool.query(`
      SELECT CASE WHEN country = '' OR country IS NULL THEN 'Desconhecido' ELSE country END as country,
             COUNT(*) as count
      FROM messages GROUP BY country ORDER BY count DESC LIMIT 10
    `)).rows;
    const byModel = (await pool.query(`
      SELECT CASE WHEN model = '' OR model IS NULL THEN 'default' ELSE model END as model,
             COUNT(*) as count
      FROM messages GROUP BY model ORDER BY count DESC LIMIT 5
    `)).rows;
    const onlineNow = (await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count FROM messages
      WHERE timestamp >= NOW() - INTERVAL '5 minutes' AND user_id != 'anonimo'
    `)).rows[0].count;
    res.json({ byHour, byCountry, byModel, onlineNow });
  } catch {
    res.json({ byHour: [], byCountry: [], byModel: [], onlineNow: 0 });
  }
});

// EMBLEMAS POR EMAIL (admin/divulgador): só pelo painel God, nunca compráveis
app.post('/api/god/emblema', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email, emblema, acao, pin } = req.body;
    if (pin !== GOD_PIN) return res.status(401).json({ error: 'PIN de verificação incorreto' });
    if (!email || !/@/.test(email)) return res.status(400).json({ error: 'Email inválido' });
    if (!['admin', 'divulgador'].includes(emblema)) return res.status(400).json({ error: 'Emblema inválido' });
    if (acao !== 'dar' && acao !== 'retirar') return res.status(400).json({ error: 'Ação inválida' });
    let r;
    if (emblema === 'admin') {
      if (acao === 'dar') {
        r = await pool.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role, divulgador", [email]);
      } else {
        // só rebaixa admin, nunca mexe em god
        r = await pool.query("UPDATE users SET role = 'user' WHERE email = $1 AND role = 'admin' RETURNING id, email, role, divulgador", [email]);
        if (r.rows.length === 0) {
          const chk = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
          if (chk.rows.length > 0 && chk.rows[0].role !== 'admin') return res.json({ success: true, msg: 'Essa conta não é administrador (god não é rebaixado)' });
        }
      }
    } else {
      r = await pool.query('UPDATE users SET divulgador = $1 WHERE email = $2 RETURNING id, email, role, divulgador', [acao === 'dar' ? 1 : 0, email]);
    }
    if (r.rows.length === 0) return res.status(404).json({ error: 'Nenhuma conta Google com esse email' });
    res.json({ success: true, user: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// EMBLEMA DIVULGADOR: só dá/tira pelo painel God, ninguém compra
app.post('/api/god/badge', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email, divulgador, pin } = req.body;
    if (pin !== GOD_PIN) return res.status(401).json({ error: 'PIN de verificação incorreto' });
    if (!email || !/@/.test(email)) return res.status(400).json({ error: 'Email inválido' });
    const r = await pool.query('UPDATE users SET divulgador = $1 WHERE email = $2 RETURNING id, email, divulgador', [divulgador ? 1 : 0, email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Nenhuma conta Google com esse email' });
    res.json({ success: true, user: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROLE MANAGER: definir quem é user/mod/admin/god
app.post('/api/god/role', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email, role } = req.body;
    if (!['user', 'mod', 'admin', 'god'].includes(role)) {
      return res.status(400).json({ error: 'Role inválida (use user, mod, admin ou god)' });
    }
    const r = await pool.query('UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role', [role, email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true, user: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// IMPERSONATE: entrar como outro usuário (sem ver senha)
app.post('/api/god/impersonate', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { userId } = req.body;
    const r = await pool.query('SELECT id, email, name, picture, role, plan FROM users WHERE id = $1', [userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const u = r.rows[0];
    const token = jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role, plan: u.plan || 'free' }, JWT_SECRET, { expiresIn: '30m' });
    res.json({ success: true, token, user: { id: u.id, email: u.email, name: u.name, picture: u.picture } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FEATURE FLAGS: listar e criar/editar
app.get('/api/god/flags', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const r = await pool.query('SELECT * FROM feature_flags ORDER BY updated_at DESC');
    res.json({ flags: r.rows });
  } catch {
    res.json({ flags: [] });
  }
});

app.post('/api/god/flag', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { key, enabled, rollout, description } = req.body;
    if (!key) return res.status(400).json({ error: 'Chave obrigatória' });
    await pool.query(`
      INSERT INTO feature_flags (key, enabled, rollout, description, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (key) DO UPDATE SET enabled = $2, rollout = $3, description = $4, updated_at = NOW()
    `, [key, enabled ? 1 : 0, Math.min(100, Math.max(0, parseInt(rollout) || 100)), description || '']);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// KILL SWITCH: botão de pânico
app.get('/api/god/killswitch', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const r = await pool.query('SELECT kill_switch FROM app_config WHERE id = 1');
    res.json({ on: r.rows.length > 0 && r.rows[0].kill_switch == 1 });
  } catch {
    res.json({ on: false });
  }
});

app.post('/api/god/killswitch', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { on } = req.body;
    await pool.query('UPDATE app_config SET kill_switch = $1, updated_at = NOW() WHERE id = 1', [on ? 1 : 0]);
    console.log(`${on ? '🔴 KILL SWITCH ATIVADO' : '🟢 Kill switch desligado'} — IA ${on ? 'DESLIGADA' : 'ligada'}`);
    res.json({ success: true, on: !!on });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LIBERAR PLANOS (Kryno Pro / Premium) por email — exige PIN do dono pra confirmar
app.post('/api/god/plan', godMiddleware, async (req, res) => {
  try {
    await ensureDB();
    const { email, plan, pin } = req.body;
    if (pin !== GOD_PIN) return res.status(401).json({ error: 'PIN de verificação incorreto' });
    if (!['free', 'pro', 'premium'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' });
    if (!email || !/@/.test(email)) return res.status(400).json({ error: 'Email inválido' });
    const r = await pool.query('UPDATE users SET plan = $1 WHERE email = $2 RETURNING id, email, plan', [plan, email]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Nenhuma conta Google com esse email' });
    res.json({ success: true, user: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
