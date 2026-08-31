// ===== KRYNO IA - LÓGICA DO FRONTEND =====

let chatHistory = [];
let uploadedImage = null;
let currentTab = 'chat';

// ===== COMANDOS =====
const COMANDOS = [
  { cat: '💬 Chat e Conversa', items: [
    'Responder qualquer pergunta','Dar conselho amoroso','Dar conselho de amizade','Escrever texto de bom dia','Escrever texto de boa noite','Criar cantada engraçada','Criar cantada fofa','Criar desculpa criativa','Pedir desculpa','Pedir em namoro','Texto de término','Analisar print de conversa','O que responder no WhatsApp','Resposta fria e seca','Resposta carinhosa','Traduzir gíria','Explicar meme','Criar meme','Criar piada','Contar história','História de terror','História infantil','História pra dormir','Sugerir presente','Nome pra cachorro','Nome pra gato','Nome pra filho','Nome pra filha','Nome pra empresa','Nome pra loja','Criar username','Criar bio Instagram','Criar bio TikTok','Criar legenda de foto','Criar status WhatsApp','Responder caixinha Instagram','Criar texto pra LinkedIn','Criar discurso','Criar juramento','Criar carta de amor','Criar poema','Criar rima','Criar haikai','Criar roteiro de vídeo','Criar diário pessoal','Criar mensagem de aniversário','Criar mensagem de condolências','Criar convite de festa','Criar agradecimento','Criar texto motivacional','Criar afirmacao positiva','Criar mantra do dia','Criar horóscopo personalizado','Criar previsão do dia','Criar desafio do dia','Criar roleta de decisões','CriarSim/Não mágico','Criar basta Sorte ou realidade','Criar jogo de adivinhação','Criar charada','Criar adivinha','Criar trava-língua','Criar par ou ímpar','Criar desafio de palavras','Criar forca','Criar quiz de personalidade','Criar test de compatibilidade','Criar simulador de namoro','Criar roteiro de sonho','Interpretar sonho','Interpretar signo','Criar perfil de personalidade','Criar descrição de signo','Criar compatibilidade de signos','Criar carta do tarot virtual','Criar mensagem secreta (cifra)','Criar código de criptografia','Criar senhas aleatórias','Criar código Morse','Criar texto ao contrário','Criar texto zAlTdO','Criar mensagemvip reversa','Criar rima dupla','Criar poema acróstico','Criar cronograma do dia','Criar checklist de tarefas','Criar planejamento de estudos','Criar planejamento de metas','Criar plano de 30 dias','Criar plano fitness','Criar cronograma de sono','Criar relatório de produtividade','Criar lista de habitos','Criar lembrete de hidratação','Criar alerta de postura','Criar mensagem pra crush','Criar mensagem pra ex','Criar mensagem pra mãe','Criar mensagem pra pai','Criar mensagem de boas-vindas','Criar apresentação pessoal','Criar descrição de produto','Criar roteiro de apresentação','Criar e-mail formal','Criar e-mail informal','Criar e-mail de agradecimento','Criar e-mail de desculpa','Criar mensagem de vendas','Criar copy de lançamento','Criar frase de impacto','Criar slogan','Criar tagline','Criar nome de playlist','Criar playlist por humor','Criar playlist por momento','Criar nome de canal YouTube','Criar nome de podcast','Criar nome de comunidade','Criar nome de grupo de amigos','Criar nome de equipe','Criar nome de banda','Criar nome de mascote','Criar nome de pet exótico','Criar nome de dragão','Criar nome de RPG','Criar nome de personagem','Criar nome de cidade fictícia','Criar nome de planeta','Criar nome de espada','Criar nome de poção','Criar nome de feitiço','Criar nome de guilda','Criar nome de loja de fantasia','Criar nome de taverna','Criar nome de reino','Criar nome de criatura','Criar nome de deus','Criar nome de herói','Criar nome de vilão','Criar nome de mech','Criar nome de nave','Criar nome de robô','Criar nome de IA','Criar nome de app','Criar nome de startup','Criar nome de projeto','Criar nome de evento','Criar nome de festival','Criar nome de bar','Criar nome de restaurante','Criar nome de café','Criar nome de hamburgueria','Criar nome de pizzaria','Criar nome de hamburguer','Criar nome de drink','Criar nome de prato','Criar nome de sobremesa','Criar nome de bolo','Criar nome de doce','Criar nome de sorvete','Criar nome de cerveja','Criar nome de vinho','Criar nome de cocktail','Criar nome de perfume','Criar nome de fragrância','Criar nome de cor','Criar nome de planeta distante','Criar nome de constelação','Criar nome de estrela','Criar nome de galáxia','Criar nome de buraco negro','Criar nome de cometa','Criar nome de asteroide','Criar nome de lua','Criar nome de cratera','Criar nome de oceano fictício'
  ]},
  { cat: '📚 Estudos', items: [
    'Resolver conta de matemática','Resolver bhaskara','Resolver regra de 3','Explicar fração','Explicar porcentagem','Explicar física','Explicar química','Explicar tabela periódica','Explicar biologia','Explicar mitose','Resumir livro','Resumir capítulo','Resumo pra prova','Mapa mental','Flashcard','Criar questão de prova','Corrigir redação ENEM','Dar nota ENEM 0-1000','Criar introdução redação','Criar desenvolvimento','Criar conclusão','Corrigir português','Explicar crase','Explicar verbo','Explicar história do Brasil','Explicar 2ª Guerra','Explicar Revolução Industrial','Explicar filosofia','Explicar sociologia','Converter cm pra metro','Converter Fahrenheit pra Celsius','Converter km pra milhas','Calcular área do círculo','Calcular área do triângulo','Calcular volume','Calcular densidade','Explicar fotossíntese','Explicar respiração celular','Explicar DNA','Explicar evolução','Explicar sistema solar','Explicar buraco negro','Explicar teoria da relatividade','Explicar tabela de Minecraft','Explicar big bang','Explicar genética','Explicar ecologia','Explicar sistema imunológico','Explicar sistema nervoso','Explicar células-tronco','Explicar vacina','Explicar vírus','Explicar bactéria','Explicar fungos','Explicar reinos biológicos','Explicar cadeia alimentar','Explicar ciclo da água','Explicar ciclo do carbono','Explicar efeito estufa','Explicar mudança climática','Explicar geografia física','Explicar capitais do mundo','Explicar mapas','Explicar economia','Explicar inflação','Explicar PIB','Explicar bolsa de valores','Explicar juros compostos','Calcular juros compostos','Calcular juros simples','Calcular média','Calcular mediana','Calcular moda','Explicar probabilidade','Explicar estatística','Explicar geometria','Explicar álgebra','Explicar trigonometria','Explicar funções','Explicar logaritmos','Explicar matrizes','Explicar derivadas','Explicar integrais','Explicar literatura','Explicar modernismo','Explicar romantismo','Explicar simbolismo','Explicar poesia','Explicar prosa','Analisar poema','Analisar obra literária','Criar cronograma ENEM','Criar cronograma vestibular','Criar simulado','Criar resumo de matéria','Explicar Arturo','Explicar droit civil','Explicar direito constitucional','Explicar cidadania','Explicar democracia','Explicar fascismo','Explicar comunismo','Explicar capitalismo','Explicar socialismo','Explicar imperialismo','Explicar feudalismo','Explicar renascimento','Explicar iluminismo','Explicar escravidão no Brasil','Explicar independência do Brasil','Explicar era vargas','Explicar ditadura militar','Explicar revolução francesa','Explicar guerra fria','Explicar globalização','Explicar revolução tecnológica','Explicar era da informação','Explicar inteligência artificial','Explicar internet','Explicar blockchain','Explicar criptomoedas','Explicar NFT','Explicar metaverso','Explicar realidade virtual','Explicar programação básica','Explicar HTML','Explicar CSS','Explicar JavaScript','Explicar Python','Explicar algoritmos','Explicar banco de dados','Explicar nuvem (cloud)','Explicar cibersegurança','Explicar phishing','Explicar senhas seguras','Criar resumo em tópicos','Criar mnemônico','Criar esquema de revisão','Criar cronograma de leitura','Explicar teoria das cordas','Explicar mecânica quântica','Explicar paradoxo','Explicar viagem no tempo','Explicar vida em outros planetas','Explicar SETI','Explicar sondas espaciais','Explicar ISS','Explicar foguetes','Explicar gravidade','Explicar velocidade da luz','Explicar relatividade geral','Explicar buraco de minhoca','Explicar matéria escura','Explicar energia escura','Explicar antimatéria','Explicar fusão nuclear','Explicar fissão nuclear','Explicar radioatividade','Explicar isótopos','Explicar ligações químicas','Explicar pH','Explicar reações químicas','Explicar estequiometria','Explicar soluções químicas','Explicar ácidos e bases','Explicar oxirredução','Explicar termodinâmica','Explicar cinética química','Explicar eletroquímica','Explicar química orgânica','Explicar compostos aromáticos','Explicar polímeros','Explicar petroquímica','Explicar bioquímica','Explicar neurociência','Explicar psicologia','Explicar comportamento','Explicar cognição','Explicar memória','Explicar emoções','Explicar inteligência','Explicar aprendizagem','Explicar linguística','Explicar fonética','Explicar semântica','Explicar pragmática','Explicar sintaxe','Explicar morfologia'
  ]},
  { cat: '💼 Trabalho e Grana', items: [
    'Criar currículo','Carta de apresentação','E-mail profissional','E-mail de cobrança','Proposta comercial','Descrição de produto que vende','Legenda que vende','Roteiro de Reels','Roteiro TikTok','Roteiro YouTube','Título chamativo','Criar hashtag','Planejamento de posts da semana','Ideia de vídeo viral','Bio de empresa','Calcular lucro','Calcular desconto','Criar planilha','Criar contrato simples','Ideia de negócio com 100 reais','Nome de marca','Slogan','Pitch de venda','Elevator pitch','Criar funil de vendas','Criar landing page copy','Criar e-mail marketing','Criar sequência de e-mails','Criar autodestponder','Criar chatbot de vendas','Criar persona de cliente','Criar análise SWOT','Criar matriz BCG','Criar CANVAS','Criar cronograma de projeto','Criar plano de marketing','Criar plano de negócios','Criar estudo de viabilidade','Calcular ROI','Calcular ponto de equilíbrio','Calcular margem de lucro','Calcular precificação','Criar tabela de preços','Criar orçamento pessoal','Criar planilha de gastos','Criar controle financeiro','Criar metas financeiras','Criar plano de economia','Calcular juros de empréstimo','Simular financiamento','Simular investimento em CDB','Simular Tesouro Direto','Explicar ações da bolsa','Explicar Fundo Imobiliário','Explicar ETF','Explicar dividendos','Explicar day trade','Explicar swing trade','Explicar value investing','Criar portfólio de investimentos','Criar perfil de investidor','Sugerir livro de finanças','Sugerir podcast de negócios','Sugerir canal de investimentos','Criar texto para LinkedIn','Criar post de conquer','Criar post de thought leadership','Criar networking message','Criar follow-up message','CriarCold email','Criar sales script','Criar objection handling','Criar faq de produto','Criar termos de serviço','Criar política de privacidade','Criar política de reembolso','Criar regras de grupo','Criar termos de afiliação','Criar programa de fidelidade','Criar sistema de pontos','Criar cupom de desconto','Criar promoção relâmpago','Criar black friday copy','Criar texto de countdown','Criar urgência em copy','Criar escassez em copy','Criar prova social','Criar depoimento fictício modelo','Criar case de sucesso modelo','Criar storytelling de marca','Criar manifesto de marca','Criar missão visão valores','Criar rebranding plan','Criar naming brief','Criar style guide básico','Criar paleta de cores','Criar tipografia suggestion','Criar moodboard descritivo','Criar conceito criativo','Criar big idea','Criar headline power','Criar subheadline','Criar CTA power','Criar bullet points de benefícios','Criar garantia copy','Criar bonus copy','Criar upsell copy','Criar cross-sell copy','Criar downsell copy','Criar order bump copy'
  ]},
  { cat: '🎨 Imagina (Imagens)', items: [
    'Imagina cachorro astronauta','Imagina gato samurai','Imagina logo da Kryno','Imagina wallpaper 4K anime','Imagina foto de perfil fofa','Imagina tatuagem de leão','Imagina desenho estilo Pixar','Imagina casa futurista','Imagina carro do futuro','Imagina look de roupa','Imagina arte pra camisa','Imagina capa de livro','Imagina thumbnail YouTube','Imagina avatar gamer','Imagina cenário cyberpunk','Imagina castelo medieval','Imagina dragão flamejante','Imagina cidade flutuante','Imagina robô samurai','Imagina floresta mágica','Imagina praia paradisíaca','Imagina montanha nevada','Imagina deserto ao pôr do sol','Imagina aurora boreal','Imagina galáxia colorida','Imagina planeta desconhecido','Imagina criatura mitológica','Imagina fênix renascendo','Imagina lobo na lua','Imagina raposa astronauta','Imagina ninja na chuva','Imagina palácio árabe','Imagina templo japonês','Imagina vila medieval','Imagina nave espacial','Imagina cidade submersa','Imagina jardim secreto','Imagina biblioteca infinita','Imagina café aconchegante','Imagina quarto gamer','Imagina sala futurista','Imagina ponte sobre neblina','Imagina farol solitário','Imagina trem noturno','Imagina balão no céu','Imagina pipa colorida','Imagina arco-íris duplo','Imagina cachoeira tropical','Imagina vulcão ativo','Imagina gelo eterno','Imagina floresta de cristais','Imagina cidade de vidro','Imagina árvore gigante','Imagina cogumelo mágico','Imagina fada na floresta','Imagina unicórnio arco-íris','Imagina sereia no recife','Imagina grifo voador','Imagina kraken no oceano','Imagina minotauro no labirinto','Imagina cyclope','Imagina zumbi fofo','Imagina vampiro elegante','Imagina lobisomem na lua','Imagina fantasma brincalhão','Imagina bruxa moderna','Imagina mago anciao','Imagina cavaleiro em armadura','Imagina princesa rebelde','Imagina pirata espacial','Imagina cowboy do futuro','Imagina detetive noir','Imagina heroína cyberpunk','Imagina vilão elegante','Imagina robô dançarino','Imagina gatinho ninja','Imagina cachorro super-herói','Imagina pinguim surfista','Imagina leão rei','Imagina corvo filósofo','Imagina coruja sábia','Imagina raposa dançarina','Imagina elefante astronauta','Imagina coelho mágico','Imagina tartaruga ninja','Imagina panda samurai','Imagina urso polar guitarist','Imagina golfinho cósmico','Imagina borboleta galáctica','Imagina abelha rainha','Imagina formiga operária','Imagina joaninha sortuda','Imagina escorpião cyber','Imagina cobra neon','Imagina tubarão laser','Imagina polvo DJ','Imagina lula gigante','Imagua medusa luminosa','Imagina estrela-do-mar psychic','Imagina ouriço cibernético','Imagina caracol espacial','Imagina centopeia de luz','Imagina borboleta de cristal','Imagina libélula holográfica','Imagina vaga-lume gigante'
  ]},
  { cat: '📷 Foto e Visão', items: [
    'Descrever foto','Ler texto de foto','Traduzir texto de foto','Resolver questão de foto','Resolver conta de foto','Identificar planta por foto','Identificar raça de cachorro por foto','Identificar raça de gato','Ler receita de foto','Ler placa de trânsito','Ler rótulo','Explicar meme de foto','Melhorar prompt de foto','Criar legenda pra foto enviada','Identificar objeto','Identificar cor','Identificar estilo de arte','Identificar época histórica','Identificar bandeira','Identificar monumento','Identificar mapa','Identificar gráfico','Identificar diagrama','Identificar código','Identificar erro de código','Identificar formula química','Identificar equação matemática','Identificar tabela','Identificar figura geométrica','Identificar padrão','Identificar textura','Identificar material','Identificar tecido','Identificar tipo de comida','Identificar prato','Identificar fruta','Identificar verdura','Identificar legume','Identificar moeda','Identificar cédula','Identificar selo','Identificar QR code','Identificar código de barras','Identificar documento','Identificar RG','Identificar CNH','Identificar passaporte','Identificar cartão','Identificar embalagem','Identificar remédio','Identificar vitamina','Identificar supplement','Identificar tipo de calçado','Identificar tipo de roupa','Identificar marca de roupa','Identificar estilo de moda','Identificar corte de cabelo','Identificar acessório','Identificar joia','Identificar tatuagem','Identificar piercing','Identificar maquiagem','Identificar penteado'
  ]},
  { cat: '🎤 Áudio e Voz', items: [
    'Transcrever áudio 30s','Transcrever áudio 2min','Transcrever áudio 10min','Resumir áudio','Traduzir áudio','Identificar idioma do áudio','Transformar áudio em texto formal','Criar resposta pro áudio','Transcrever podcast','Transcrever reunião','Transcrever aula','Transcrever entrevista','Resumir podcast','Resumir reunião','Resumir aula','Traduzir áudio inglês-português','Traduzir áudio espanhol-português','Traduzir áudio português-ingles','Identificar música pelo áudio','Criar legenda para áudio','Converter áudio em bullet points','Extrair action items do áudio','Criar ata de reunião do áudio','Criar e-mail a partir do áudio','Criar tarefa a partir do áudio','Criar resumo executivo do áudio','Transcrever áudio com timestamps','Separar falantes do áudio','Corrigir transcrição','Formatar transcrição','Adicionar pontuação à transcrição'
  ]},
  { cat: '🍽️ Vida Real', items: [
    'Receita com ovo e arroz','Receita fit','Receita vegana','Jantar romântico','Harmonizar bebida com prato','Calcular calorias','Criar dieta 1200kcal','Criar treino academia','Treino em casa sem peso','Dica de filme Netflix','Dica de série','Dica de anime','Dica de livro','Roteiro de viagem barata','Roteiro 3 dias em SP','Previsão do tempo','Notícia do dia','Resultado futebol','Horóscopo do dia','Traduzir letra de música','Receita de bolo simples','Receita de pão caseiro','Receita de brigadeiro','Receita de pizza caseira','Receita de hamburguer caseiro','Receita de salada completa','Receita de suco verde','Receita de vitamina','Receita de smoothie','Receita de sopa','Receita de macarrão rápido','Receita de arroz de panela','Receita de feijão','Receita de frango assado','Receita de lasanha','Receita de pão de queijo','Receita de tapioca','Receita de crepioca','Receita de pudim','Receita de mousse','Receita de geleia caseira','Receita de pão integral','Receita de granola','Receita de iogurte natural','Receita de picles caseiro','Receita de fermentação natural','Plano de treino para iniciante','Treino de pernas','Treino de braço','Treino de peito','Treino de costas','Treino de ombro','Treino de abdômen','Treino de glúteo','Treino full body','Treino HIIT','Treino cardio','Treino de mobilidade','Treino de alongamento','Plano de corrida iniciante','Plano de corrida 5k','Plano de corrida 10k','Dica de filme de terror','Dica de filme de ação','Dica de filme de comédia','Dica de filme de romance','Dica de filme sci-fi','Dica de série de drama','Dica de série de comédia','Dica de série policial','Dica de anime shounen','Dica de anime slice of life','Dica de livro de autoajuda','Dica de livro de ficção','Dica de livro de não-ficção','Dica de podcast','Roteiro de viagem RJ','Roteiro de viagem Nordeste','Roteiro de viagem Sul','Roteiro de viagem Europa barata','Roteiro de viagem Asia','Dica de APP de meditação','Criar playlist de relaxamento','Criar playlist de foco','Criar playlist de treino','Criar playlist de festa','Criar playlist de estudo','Criar playlist de viagem','Sugerir hobby novo','Sugerir curso online','Sugerir curso gratuito','Sugerir livro de desenvolvimento pessoal','Sugerir hábito saudável','Criar rotina matinal','Criar rotina noturna','Criar rotina de skincare','Criar rotina de autocuidado','Criar checklist de viagem','Criar lista de mochila','Criar lista de supermercado','Criar lista de compras','Criar planejamento de festa','Criar checklist de mudança','Criar lista de desejos','Criar lista de metas do ano','Criar lista de sonhos','Criar balde de projetos','Criar lista de agradecimentos','Criar diary entry'
  ]},
  { cat: '🔐 Admin e Sistema', items: [
    'Login admin com senha','Login admin com PIN','Ver todos usuários cadastrados','Ver e-mail de todos usuários','Ver histórico de qualquer usuário','Ver total de mensagens','Ver total de visitantes','Banir usuário por e-mail','Desbanir usuário','Apagar histórico de usuário','Ver logs do sistema','Dashboard admin com gráficos','Estatística de uso por dia','Salvar conversa no histórico','Buscar no histórico','Exportar histórico em TXT','Apagar histórico','Continuar conversa antiga','Ver últimas 10 conversas'
  ]}
];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  renderComandos();
});

async function checkAuth() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      showChatScreen(data.user);
    }
  } catch {}
}

function showChatScreen(user = null) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  const avatar = document.getElementById('user-avatar');
  const info = document.getElementById('user-info');
  if (user) {
    const name = user.name || 'Convidado';
    avatar.textContent = name.trim().charAt(0).toUpperCase() || '?';
    info.innerHTML = `<div class="u-name">${name}</div><div class="u-email">${user.email || ''}</div>`;
    renderSidebarHistorico();
  } else {
    avatar.textContent = '?';
    info.innerHTML = `<div class="u-name">Convidado</div>`;
  }
}

function enterAsGuest() {
  showChatScreen();
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  location.reload();
}

// ===== TABS =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
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
      <div class="sidebar-hist-item" onclick="switchTab('historico')" title="${escapeHtml(m.user_message)}">
        ${escapeHtml(m.user_message).slice(0, 40)}
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

function addMessage(sender, text) {
  const container = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = `msg-row ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? '🙂' : '⚡';

  const col = document.createElement('div');
  col.className = 'msg-col';

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = sender === 'user' ? 'Você' : 'Kryno IA';

  const bubble = document.createElement('div');
  bubble.className = 'msg';
  bubble.textContent = text;

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
        <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
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
        <div class="timestamp">${new Date(m.timestamp).toLocaleString('pt-BR')}</div>
        <div class="user-msg">Você: ${escapeHtml(m.user_message)}</div>
        <div class="bot-msg">Kryno: ${escapeHtml(m.bot_reply)}</div>
      </div>
    `).join('');
  } catch {}
}

async function limparHistorico() {
  if (!confirm('Apagar todo o histórico?')) return;
  await fetch('/api/historico', { method: 'DELETE' });
  carregarHistorico();
}

function exportarHistorico() {
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

// ===== ACESSO SECRETO AO ADMIN (Ctrl+Alt+A) =====
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-admin').classList.add('active');
    closeSidebarOnMobile();
  }
});

// ===== LOGIN APPLE (placeholder até configurar Sign in with Apple) =====
function loginApple() {
  alert('Login com Apple em breve! Por enquanto, use Google ou entre sem cadastro. 🍎');
}
