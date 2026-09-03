// ===== KRYNO IA - LÓGICA DO FRONTEND =====

// ===== INICIALIZAÇÃO =====
async function initApp() {
  // Se veio pela rota /admin (easter egg), abrir direto no painel admin
  const isAdminBoot = window.location.pathname === '/admin';
  if (isAdminBoot) {
    try { history.replaceState(null, '', '/'); } catch {}
  }

  // Check if user is already logged in (Google OAuth cookie)
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      showChatScreen(data.user);
      if (isAdminBoot) abrirPainelAdmin();
      return;
    }
  } catch {}

  if (isAdminBoot) {
    // Sem login (guest) mas veio validado pelo código admin: mostra o painel de qualquer forma
    showChatScreen(null);
    abrirPainelAdmin();
    return;
  }

  // Not logged in - show login screen
  document.getElementById('login-screen').classList.remove('hidden');
}

function showChatScreen(user = null) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  const avatar = document.getElementById('user-avatar');
  const info = document.getElementById('user-info');
  if (user) {
    const name = user.name || user.email || 'Convidado';
    avatar.textContent = name.trim().charAt(0).toUpperCase() || '?';
    info.innerHTML = `<div class="u-name">${name}</div>`;
  } else {
    avatar.textContent = '?';
    info.innerHTML = `<div class="u-name">Convidado</div>`;
  }
  renderSidebarHistorico();
}

let chatHistory = [];
let uploadedImage = null;
let currentTab = 'chat';
let isGuest = false;

// ===== HISTÓRICO GUEST (local, privado por navegador - LGPD) =====
const GUEST_KEY = 'kryno_guest_chats';
const GUEST_CHAT_ID_KEY = 'guest_chat_id';

// Carrega sessões de guest (migra formato antigo automaticamente)
function guestLoadSessions() {
  let data;
  try { data = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'); }
  catch { return []; }
  if (!Array.isArray(data)) return [];

  let migrated = false;
  const sessions = data.map(item => {
    if (item && Array.isArray(item.messages)) return item; // formato novo
    // formato antigo (1 item por mensagem) -> vira uma sessão
    migrated = true;
    return {
      id: item.id || Date.now(),
      title: (item.user_message || '[imagem]').substring(0, 40),
      messages: [
        { role: 'user', content: item.user_message || '[imagem]' },
        { role: 'assistant', content: item.bot_reply || '' }
      ],
      created_at: item.timestamp || new Date().toISOString(),
      updated_at: item.timestamp || new Date().toISOString()
    };
  });
  if (migrated) {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(sessions.slice(-50))); } catch {}
  }
  return sessions;
}

function guestSaveSessions(sessions) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(sessions.slice(-50))); }
  catch { /* storage cheio */ }
}

// Adiciona mensagem na SESSÃO ATUAL do guest (cria a sessão só se não existir)
function guestAddMessage(userMessage, botReply) {
  const sessions = guestLoadSessions();
  let chatId = localStorage.getItem(GUEST_CHAT_ID_KEY);
  let session = sessions.find(s => String(s.id) === String(chatId));

  if (!session) {
    session = {
      id: Date.now(),
      title: (userMessage || '[imagem]').substring(0, 40),
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    sessions.push(session);
    localStorage.setItem(GUEST_CHAT_ID_KEY, String(session.id));
  }

  session.messages.push({ role: 'user', content: userMessage || '[imagem]' });
  if (botReply) session.messages.push({ role: 'assistant', content: botReply });
  session.title = session.messages[0].content.substring(0, 40);
  session.updated_at = new Date().toISOString();
  guestSaveSessions(sessions);
}

// Abre uma sessão de guest no chat
function guestOpenSession(id) {
  const sessions = guestLoadSessions();
  const session = sessions.find(s => String(s.id) === String(id));
  if (!session) return;
  localStorage.setItem(GUEST_CHAT_ID_KEY, String(session.id));
  chatHistory = session.messages.map(m => ({ role: m.role, content: m.content }));
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  if (session.messages.length === 0) {
    container.innerHTML = '<div class="welcome-msg"><div class="welcome-logo">⚡</div><h2>Kryno IA</h2><p>Nova sessão iniciada! Sobre o que vamos conversar agora?</p></div>';
  } else {
    session.messages.forEach(m => addMessage(m.role === 'user' ? 'user' : 'bot', m.content));
  }
  switchTab('chat');
}

function enterAsGuest() {
  isGuest = true;
  sessionStorage.setItem('kryno_guest', '1');
  showChatScreen();
}

function loginApple() {
  alert('Login com Apple em breve! Por enquanto, use Google ou entre sem cadastro. 🍎');
}


// ===== LOGIN GOOGLE (redirect flow - funciona no site e TWA) =====
function loginGoogleGIS() {
  window.location.href = '/auth/google';
}

async function handleGoogleCredential(response) {
  // Mantida para compatibilidade caso GIS carregue
  try {
    const res = await fetch('/auth/google/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (data.success) {
      showChatScreen(data.user);
    }
  } catch (err) {
    alert('Erro de conexao. Tente novamente.');
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  location.reload();
}

// ===== TABS =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  const target = document.getElementById(`panel-${tab}`);
  target.classList.remove('hidden');
  target.classList.add('active');
  const tabBtn = document.getElementById(`tab-${tab}`);
  if (tabBtn) tabBtn.classList.add('active');

  if (tab === 'historico') carregarHistorico();
  if (tab === 'admin') {}

  closeSidebarOnMobile();
}

// ===== SIDEBAR (mobile toggle + nova sessão + histórico) =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }
}

function novaSessao() {
  chatHistory = [];
  uploadedImage = null;
  // Guest: limpa o chatId atual -> próxima mensagem abre uma sessão NOVA
  if (isGuest) localStorage.removeItem(GUEST_CHAT_ID_KEY);
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="welcome-msg">
      <div class="welcome-logo">⚡</div>
      <h2>Kryno IA</h2>
      <p>Nova sessão iniciada! Sobre o que vamos conversar agora?</p>
      <p class="hint">Experimente: "cria uma cantada engraçada", "me dá um conselho amoroso", "resumo do livro Dom Casmurro"...</p>
    </div>`;
  switchTab('chat');
}

async function renderSidebarHistorico() {
  const list = document.getElementById('sidebar-hist-list');
  // GUEST: sidebar com histórico local
  if (isGuest) {
    const sessions = guestLoadSessions()
      .filter(s => s.messages && s.messages.length > 0) // só sessões com mensagens
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 8);
    if (sessions.length === 0) {
      list.innerHTML = '<div class="sidebar-hist-empty">Nenhuma conversa ainda.</div>';
      return;
    }
    list.innerHTML = sessions.map(s => `
      <div class="sidebar-hist-item" title="${escapeHtml(s.title || 'Conversa')}">
        <span onclick="guestOpenSession('${s.id}')">${escapeHtml(s.title || 'Conversa').substring(0, 36)}</span>
      </div>
    `).join('');
    return;
  }
  try {
    const res = await fetch('/api/historico');
    if (res.status === 401) {
      list.innerHTML = '<div class="sidebar-hist-empty">Faça login para ver seu histórico.</div>';
      return;
    }
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      list.innerHTML = '<div class="sidebar-hist-empty">Nenhuma conversa ainda.</div>';
      return;
    }
    list.innerHTML = data.messages.slice(0, 8).map(m => `
      <div class="sidebar-hist-item" title="${escapeHtml(m.user_message)}">
        <span onclick="loadConversation(${m.id})">${escapeHtml(m.user_message).slice(0, 36)}</span>
        <button class="hist-delete-btn" onclick="event.stopPropagation(); deleteChat(${m.id})" title="Excluir">✕</button>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="sidebar-hist-empty">Erro ao carregar.</div>';
  }
}

// ===== CHAT =====
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  // Verificar se começa com "imagina"
  if (message.toLowerCase().startsWith('imagina ')) {
    switchTab('imagina');
    document.getElementById('imagina-input').value = message;
    await gerarImagem();
    input.value = '';
    return;
  }

  // Adicionar mensagem do usuário
  addMessage('user', message);
  input.value = '';

  // Remover welcome message
  const welcome = document.querySelector('.welcome-msg');
  if (welcome) welcome.remove();

  // Indicador de digitação
  const typingEl = addTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        image: uploadedImage,
        history: chatHistory.slice(-10)
      })
    });
    const data = await res.json();

    typingEl.remove();
    addMessage('bot', data.reply);

    // Salvar no histórico local
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: data.reply });
    if (isGuest) guestAddMessage(message || '[imagem]', data.reply);
    renderSidebarHistorico();
  } catch (err) {
    typingEl.remove();
    addMessage('bot', 'Ops! Deu um erro 😅 Tenta de novo!');
  }

  // Limpar imagem enviada
  uploadedImage = null;
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('image-preview').classList.remove('has-image');
}

// Limpa notação LaTeX que às vezes escapa do modelo e formata texto
function formatarTexto(text) {
  if (!text) return '';

  let t = text;

  // Remove delimitadores LaTeX \[ \] e \( \)
  t = t.replace(/\\\[/g, '').replace(/\\\]/g, '');
  t = t.replace(/\\\(/g, '').replace(/\\\)/g, '');

  // Converte \frac{a}{b} em a/b
  t = t.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');

  // Converte \times em x, \cdot em x
  t = t.replace(/\\times/g, 'x').replace(/\\cdot/g, 'x');

  // Remove \text{...} mantendo o conteúdo
  t = t.replace(/\\text\{([^{}]*)\}/g, '$1');

  // Remove outros comandos LaTeX genéricos remanescentes tipo \algumacoisa ou \,
  t = t.replace(/\\[a-zA-Z]+/g, '');
  t = t.replace(/\\[,;!]/g, '');

  // Remove markdown de cabeçalho ##, ###
  t = t.replace(/^#{1,6}\s*/gm, '');

  // Converte **negrito** ou *negrito* em <strong>
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

  // Escapa HTML restante pra evitar injeção, mas preserva as tags <strong> que criamos
  const parts = t.split(/(<strong>|<\/strong>)/g);
  t = parts.map(p => {
    if (p === '<strong>' || p === '</strong>') return p;
    const div = document.createElement('div');
    div.textContent = p;
    return div.innerHTML;
  }).join('');

  // Quebras de linha
  t = t.replace(/\n/g, '<br>');

  return t;
}

function addMessage(sender, text) {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? '🥷' : '⚡';

  const col = document.createElement('div');
  col.className = 'msg-col';

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = sender === 'user' ? 'Você' : 'Kryno IA';

  const bubble = document.createElement('div');
  bubble.className = 'msg';
  if (sender === 'bot') {
    bubble.innerHTML = formatarTexto(text);
  } else {
    bubble.textContent = text;
  }

  col.appendChild(label);
  col.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(col);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `
    <div class="avatar">⚡</div>
    <div class="msg-col">
      <div class="msg-label">Kryno pensando</div>
      <div class="msg typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

// ===== UPLOAD DE IMAGEM =====
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage = e.target.result;
    const preview = document.getElementById('image-preview');
    preview.innerHTML = `<img src="${uploadedImage}" alt="preview">`;
    preview.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

// ===== UPLOAD DE ÁUDIO =====
async function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  addMessage('user', '🎤 [Áudio enviado]');
  const typingEl = addTypingIndicator();

  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res = await fetch('/api/transcrever', { method: 'POST', body: formData });
    const data = await res.json();
    typingEl.remove();

    if (data.text) {
      addMessage('bot', `📝 Transcrição:\n\n${data.text}\n\nPosso te ajudar com algo sobre isso?`);
      chatHistory.push({ role: 'user', content: data.text });
    } else {
      addMessage('bot', data.error || 'Não consegui transcrever 😢');
    }
  } catch {
    typingEl.remove();
    addMessage('bot', 'Erro ao processar áudio 😅');
  }
}

// ===== IMAGINA =====
async function gerarImagem() {
  const input = document.getElementById('imagina-input');
  const prompt = input.value.trim();
  if (!prompt) return;

  const gallery = document.getElementById('imagina-gallery');
  const loadingId = 'loading-' + Date.now();
  gallery.innerHTML = `<div class="imagina-loading" id="${loadingId}">🎨 Gerando imagem... isso pode levar alguns segundos 🔥</div>` + gallery.innerHTML;

  try {
    const res = await fetch('/api/imagina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    document.getElementById(loadingId).remove();

    if (data.image_url) {
      const cleanPrompt = prompt.toLowerCase().startsWith('imagina ') ? prompt.substring(8) : prompt;
      const card = document.createElement('div');
      card.className = 'imagina-card';
      card.innerHTML = `<img src="${data.image_url}" alt="${cleanPrompt}"><div class="prompt-text">🎨 ${cleanPrompt}</div>`;
      gallery.insertBefore(card, gallery.firstChild);
    } else {
      gallery.innerHTML = `<div class="imagina-loading">${data.error || 'Erro ao gerar imagem 😢'}</div>`;
    }
  } catch {
    document.getElementById(loadingId).remove();
    gallery.innerHTML = `<div class="imagina-loading">Erro ao gerar imagem 😅</div>`;
  }

  input.value = '';
}

// ===== COMANDOS =====
function renderComandos() {
  const list = document.getElementById('comandos-list');
  list.innerHTML = '';
  let num = 1;
  COMANDOS.forEach(cat => {
    const catDiv = document.createElement('div');
    catDiv.className = 'comando-category';
    let itemsHtml = '';
    cat.items.forEach(item => {
      itemsHtml += `<div class="comando-item" onclick="usarComando('${item.replace(/'/g, "\\'")}')"><span class="num">${num}.</span>${item}</div>`;
      num++;
    });
    catDiv.innerHTML = `<h3>${cat.cat}</h3>${itemsHtml}`;
    list.appendChild(catDiv);
  });
}

function filtrarComandos() {
  const q = document.getElementById('comando-search').value.toLowerCase();
  document.querySelectorAll('.comando-item').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.comando-category').forEach(cat => {
    const visible = cat.querySelectorAll('.comando-item:not([style*="display: none"])').length > 0;
    cat.style.display = visible ? '' : 'none';
  });
}

function usarComando(comando) {
  switchTab('chat');
  document.getElementById('chat-input').value = comando;
  document.getElementById('chat-input').focus();
}

// ===== HISTÓRICO =====
async function carregarHistorico() {
  const list = document.getElementById('historico-list');
  list.innerHTML = '<div class="historico-item">Carregando...</div>';

  // GUEST: histórico é 100% local (privacidade/LGPD)
  if (isGuest) {
    const msgs = guestLoadChats().slice().reverse();
    if (msgs.length === 0) {
      list.innerHTML = '<div class="historico-item">Nenhuma conversa salva ainda. (No modo sem conta, o histórico fica só neste navegador)</div>';
      return;
    }
    list.innerHTML = msgs.map(m => `
      <div class="historico-item">
        <div class="hist-item-header">
          <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
          <div class="hist-item-actions">
            <button class="hist-open-btn" onclick="loadGuestConversation(${m.id})" title="Abrir no chat">💬 Abrir</button>
            <button class="hist-delete-btn" onclick="deleteGuestChat(${m.id})" title="Excluir conversa">✕ Excluir</button>
          </div>
        </div>
        <div class="user-msg">Você: ${escapeHtml(m.user_message)}</div>
        <div class="bot-msg">Kryno: ${escapeHtml(m.bot_reply)}</div>
      </div>
    `).join('');
    return;
  }

  try {
    const res = await fetch('/api/historico');
    if (res.status === 401) {
      list.innerHTML = '<div class="historico-item">Faça login com Google para salvar e ver seu histórico.</div>';
      return;
    }
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) {
      list.innerHTML = '<div class="historico-item">Nenhuma conversa salva ainda.</div>';
      return;
    }
    list.innerHTML = data.messages.map(m => `
      <div class="historico-item">
        <div class="hist-item-header">
          <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
          <div class="hist-item-actions">
            <button class="hist-open-btn" onclick="loadConversation(${m.id})" title="Abrir no chat">💬 Abrir</button>
            <button class="hist-delete-btn" onclick="deleteChat(${m.id})" title="Excluir conversa">✕ Excluir</button>
          </div>
        </div>
        <div class="user-msg">Você: ${escapeHtml(m.user_message)}</div>
        <div class="bot-msg">Kryno: ${escapeHtml(m.bot_reply)}</div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="historico-item">Erro ao carregar histórico.</div>';
  }
}

async function buscarHistorico() {
  const q = document.getElementById('historico-search').value;
  if (!q) return carregarHistorico();

  // GUEST: busca local
  if (isGuest) {
    const needle = q.toLowerCase();
    const msgs = guestLoadChats().filter(m =>
      (m.user_message || '').toLowerCase().includes(needle) ||
      (m.bot_reply || '').toLowerCase().includes(needle)
    ).slice().reverse();
    const list = document.getElementById('historico-list');
    if (msgs.length === 0) {
      list.innerHTML = '<div class="historico-item">Nada encontrado.</div>';
      return;
    }
    list.innerHTML = msgs.map(m => `
      <div class="historico-item">
        <div class="hist-item-header">
          <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
          <div class="hist-item-actions">
            <button class="hist-open-btn" onclick="loadGuestConversation(${m.id})" title="Abrir no chat">💬 Abrir</button>
            <button class="hist-delete-btn" onclick="deleteGuestChat(${m.id})" title="Excluir conversa">✕ Excluir</button>
          </div>
        </div>
        <div class="user-msg">Você: ${escapeHtml(m.user_message)}</div>
        <div class="bot-msg">Kryno: ${escapeHtml(m.bot_reply)}</div>
      </div>
    `).join('');
    return;
  }

  try {
    const res = await fetch(`/api/historico/buscar?q=${encodeURIComponent(q)}`);
    if (res.status === 401) return;
    const data = await res.json();
    const list = document.getElementById('historico-list');
    if (data.messages.length === 0) {
      list.innerHTML = '<div class="historico-item">Nada encontrado.</div>';
      return;
    }
    list.innerHTML = data.messages.map(m => `
      <div class="historico-item">
        <div class="hist-item-header">
          <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
          <div class="hist-item-actions">
            <button class="hist-open-btn" onclick="loadConversation(${m.id})" title="Abrir no chat">💬 Abrir</button>
            <button class="hist-delete-btn" onclick="deleteChat(${m.id})" title="Excluir conversa">✕ Excluir</button>
          </div>
        </div>
        <div class="user-msg">Você: ${escapeHtml(m.user_message)}</div>
        <div class="bot-msg">Kryno: ${escapeHtml(m.bot_reply)}</div>
      </div>
    `).join('');
  } catch {}
}

async function loadConversation(id) {
  try {
    const res = await fetch('/api/historico');
    const data = await res.json();
    const msg = data.messages.find(m => m.id === id);
    if (!msg) {
      alert('Conversa não encontrada.');
      return;
    }
    // Switch to chat tab and show the conversation
    chatHistory = [
      { role: 'user', content: msg.user_message },
      { role: 'assistant', content: msg.bot_reply }
    ];
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    addMessage('user', msg.user_message);
    addMessage('bot', msg.bot_reply);
    switchTab('chat');
  } catch (err) {
    alert('Erro ao carregar conversa.');
  }
}

// ===== FUNÇÕES GUEST (localStorage) =====
function loadGuestConversation(id) {
  const msg = guestLoadChats().find(m => m.id === id);
  if (!msg) { alert('Conversa não encontrada.'); return; }
  chatHistory = [
    { role: 'user', content: msg.user_message },
    { role: 'assistant', content: msg.bot_reply }
  ];
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  addMessage('user', msg.user_message);
  addMessage('bot', msg.bot_reply);
  switchTab('chat');
}

function deleteGuestChat(id) {
  if (!confirm('Excluir esta conversa do histórico?')) return;
  const chats = guestLoadChats().filter(m => m.id !== id);
  guestSaveChats(chats);
  carregarHistorico();
  renderSidebarHistorico();
}

async function deleteChat(id) {
  if (!confirm('Excluir esta conversa do histórico?')) return;
  if (isGuest) return deleteGuestChat(id);
  try {
    const res = await fetch(`/api/historico/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success !== false) {
      carregarHistorico();
      renderSidebarHistorico();
    } else {
      alert('Erro ao excluir: ' + (data.error || 'tente novamente'));
    }
  } catch {
    alert('Erro de conexão. Tente novamente.');
  }
}

async function limparHistorico() {
  if (!confirm('Apagar todo o histórico?')) return;
  if (isGuest) {
    guestSaveChats([]);
    carregarHistorico();
    renderSidebarHistorico();
    return;
  }
  await fetch('/api/historico', { method: 'DELETE' });
  carregarHistorico();
}

function exportarHistorico() {
  if (isGuest) {
    const chats = guestLoadChats();
    if (chats.length === 0) { alert('Nenhuma conversa para exportar.'); return; }
    let txt = '=== HISTÓRICO KRYNO IA (modo sem conta) ===\n\n';
    chats.forEach(m => {
      txt += `[${new Date(m.timestamp).toLocaleString('pt-BR')}]\nVocê: ${m.user_message}\nKryno: ${m.bot_reply}\n\n---\n\n`;
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'historico-kryno-guest.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  window.open('/api/historico/exportar', '_blank');
}

// ===== ADMIN =====
async function loginAdmin() {
  const pass = document.getElementById('admin-pass').value;
  const pin = document.getElementById('admin-pin').value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass, pin })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('admin-login-box').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      carregarAdmin();
    } else {
      alert(data.error || 'Erro ao logar');
    }
  } catch {
    alert('Erro de conexão');
  }
}

async function carregarAdmin() {
  try {
    const [statsRes, usersRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/users')
    ]);
    const stats = await statsRes.json();
    const users = await usersRes.json();

    const statsDiv = document.getElementById('admin-stats');
    statsDiv.innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.totalUsers}</div><div class="stat-label">Usuários</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalMessages}</div><div class="stat-label">Mensagens</div></div>
      <div class="stat-card"><div class="stat-value">${stats.todayMessages}</div><div class="stat-label">Mensagens Hoje</div></div>
      <div class="stat-card"><div class="stat-value">${stats.bannedUsers}</div><div class="stat-label">Banidos</div></div>
    `;

    const usersDiv = document.getElementById('admin-users-list');
    usersDiv.innerHTML = users.users.map(u => `
      <div class="admin-user-item">
        ${u.picture ? `<img src="${u.picture}" alt="">` : '<div style="width:36px;height:36px;border-radius:50%;background:#333;display:flex;align-items:center;justify-content:center;">👤</div>'}
        <div class="info">
          <div class="name">${u.name || 'Sem nome'}</div>
          <div class="email">${u.email}</div>
        </div>
        ${u.banned ? '<span class="banned-badge">Banido</span>' : `<button onclick="banirUsuario('${u.email}')" style="background:rgba(255,50,50,.2);color:#ff6b6b;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;">Banir</button>`}
      </div>
    `).join('');
  } catch (err) {
    console.error('Erro admin:', err);
  }
}

async function banirUsuario(email) {
  await fetch('/api/admin/ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  carregarAdmin();
}

// ===== UTILS =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== PLANOS =====
function abrirPlanos() {
  document.getElementById('planos-overlay').classList.remove('hidden');
  closeSidebarOnMobile();
}

function fecharPlanos() {
  document.getElementById('planos-overlay').classList.add('hidden');
}

function assinarPlano(plano) {
  // TODO: conectar aqui com o link de pagamento real (Kiwify / Mercado Pago / Stripe)
  alert('Assinatura do plano ' + (plano === 'pro' ? 'Kryno Pro 💎' : 'Kryno Premium 🥇') + ' em breve! Estamos configurando o pagamento.');
}

// ===== ACESSO SECRETO AO ADMIN =====
// PC: Ctrl+Alt+A | Celular: 5 toques rápidos (3s) no logo "Kryno IA"
const ADMIN_SECRET = 'krynoadmin'; // <- troque o código aqui
const ADMIN_TAP_WINDOW = 3000;   // janela de 3s para os 5 toques
const ADMIN_MAX_TRIES = 3;        // tentativas antes de bloquear
const ADMIN_LOCK_MS = 5 * 60 * 1000; // bloqueio de 5 minutos

function abrirPainelAdmin() {
  // Precisa ter entrado no app (chat-screen visível) antes de mostrar o painel
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');

  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const painel = document.getElementById('panel-admin');
  painel.classList.remove('hidden');
  painel.classList.add('active');
  closeSidebarOnMobile();
}

// PC: Ctrl+Alt+A mantido
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
    abrirPainelAdmin();
  }
});

// Easter egg mobile: 5 toques rápidos no logo -> prompt de código admin
(function () {
  let taps = 0;
  let firstTapTs = 0;

  document.addEventListener('click', (e) => {
    const logo = e.target.closest('#logo-kryno, #logo-kryno-mobile');
    if (!logo) return;

    const now = Date.now();
    // Resetar contador se passou da janela de 3s
    if (!firstTapTs || (now - firstTapTs) > ADMIN_TAP_WINDOW) {
      taps = 0;
      firstTapTs = now;
    }
    taps++;

    if (taps >= 5) {
      taps = 0;
      firstTapTs = 0;
      pedirCodigoAdmin();
    }
  });
})();

function pedirCodigoAdmin() {
  // Verificar bloqueio
  const lockUntil = parseInt(localStorage.getItem('kryno_admin_lock') || '0');
  const now = Date.now();
  if (now < lockUntil) {
    const min = Math.ceil((lockUntil - now) / 60000);
    alert('Bloqueado. Tente novamente em ' + min + ' min.');
    return;
  }

  const codigo = prompt('Código admin');
  if (codigo === null || codigo === '') return; // cancelou, não conta tentativa

  if (codigo === ADMIN_SECRET) {
    localStorage.setItem('isAdmin', 'true');
    localStorage.removeItem('kryno_admin_tries');
    window.location.href = '/admin';
    return;
  }

  // Código errado
  let tries = parseInt(localStorage.getItem('kryno_admin_tries') || '0') + 1;
  if (tries >= ADMIN_MAX_TRIES) {
    localStorage.setItem('kryno_admin_lock', String(Date.now() + ADMIN_LOCK_MS));
    localStorage.removeItem('kryno_admin_tries');
    alert('Código incorreto. Acesso bloqueado por 5 minutos.');
  } else {
    localStorage.setItem('kryno_admin_tries', String(tries));
    alert('Código incorreto. (' + tries + '/' + ADMIN_MAX_TRIES + ')');
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
