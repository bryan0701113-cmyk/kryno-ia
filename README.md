# 🔥 Kryno IA

Sua inteligência artificial completa. Chat, estudos, trabalho, imagens, áudio, histórico e painel admin — tudo em um só app.

## 🚀 Funcionalidades

### 💬 Chat e Conversa (1-150)
Responder perguntas, conselhos amorosos, cantadas, textos, legendas, nomes, bios, memes, piadas, histórias e muito mais.

### 📚 Estudos (151-280)
Matemática, física, química, biologia, resumos, mapas mentais, flashcards, correção de redação ENEM, português, história, filosofia e mais.

### 💼 Trabalho e Grana (281-380)
Currículo, e-mails profissionais, propostas comerciais, roteiros de Reels/TikTok/YouTube, planos de marketing, finanças, investimentos e mais.

### 🎨 Imagina (381-480)
Geração de imagens com Pollinations.ai (GRATUITO, sem chave de API). Digite "Imagina [descrição]" e a Kryno cria a imagem.

### 📷 Foto e Visão (481-540)
Envie uma foto e a Kryno descreve, lê texto, identifica objetos, plantas, animais, resolve questões e mais.

### 🎤 Áudio e Voz (541-580)
Transcrição de áudio, resumo, tradução, identificação de idioma com Groq Whisper.

### 🍽️ Vida Real (581-620)
Receitas, treinos, dietas, dicas de filmes/séries/animes, roteiros de viagem, playlists e mais.

### 🔐 Login Google (601-620)
Login com Google OAuth, perfil, logout.

### 📜 Histórico (621-635)
Salvar, buscar, exportar e apagar conversas.

### 🛡️ Painel Admin (636-650)
Dashboard com estatísticas, gerenciar usuários, banir/desbanir, ver histórico de qualquer usuário.

## 🧱 Stack

- Node.js + Express
- SQLite (better-sqlite3)
- **Groq API** (Llama 3.3 70B para chat, Whisper para áudio)
- **Pollinations.ai** (Geração de imagens - GRATUITO)
- Google OAuth (login)
- HTML/CSS/JS (sem framework, puro e rápido)

## 📦 Deploy na Railway

### Passo a passo:

1. Crie uma conta em https://railway.app
2. Faça upload deste projeto para um repositório GitHub
3. Na Railway, clique em "New Project" → "Deploy from GitHub repo"
4. Selecione seu repositório
5. Configure as variáveis de ambiente:

```
GROQ_API_KEY=sua-chave-groq
ADMIN_PASS=Kryno2026
ADMIN_PIN=1212
JWT_SECRET=kryno2026secreto
NODE_ENV=production
```

Opcionais (login com Google):
```
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_CALLBACK_URL=https://seu-dominio.railway.app/auth/google/callback
```

6. A Railway vai instalar as dependências e iniciar o servidor automaticamente
7. Seu app estará no ar! 🔥

### Como obter a chave da Groq (GRATUITA):

1. Acesse https://console.groq.com/keys
2. Crie uma nova chave (Create API Key)
3. Copie a chave
4. Cole na variável GROQ_API_KEY na Railway

### Como obter o Google OAuth (opcional):

1. Acesse https://console.cloud.google.com
2. Crie um projeto → APIs & Services → Credentials
3. Crie um OAuth 2.0 Client ID (tipo: Web Application)
4. Adicione a URL de callback da Railway nas authorized redirect URIs
5. Copie o Client ID e Client Secret

## 🛠️ Rodar localmente

```bash
npm install
cp .env.example .env  # Edite com sua chave da Groq
node server.js
```

Acesse http://localhost:3000

## 🔑 Credenciais Admin padrão

- Senha: Kryno2026
- PIN: 1212

## 💰 Custos

- **Groq**: Tier gratuito generoso (rate limits altos)
- **Pollinations.ai**: Gratuito (sem chave)
- **Railway**: Plano grátis disponível
- **Google OAuth**: Gratuito

---

Feito com 🔥 por Kryno IA
