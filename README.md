# 🔥 Kryno IA

Sua inteligência artificial completa. Chat, estudos, trabalho, imagens, áudio, visão, histórico e painel admin — tudo em um só app.

## 🚀 Funcionalidades

### 💬 Chat e Conversa (1-150)
Responder perguntas, conselhos amorosos, cantadas, textos, legendas, nomes, bios, memes, piadas, histórias e muito mais.

### 📚 Estudos (151-280)
Matemática, física, química, biologia, resumos, mapas mentais, flashcards, correção de redação ENEM, português, história, filosofia e mais.

### 💼 Trabalho e Grana (281-380)
Currículo, e-mails profissionais, propostas comerciais, roteiros de Reels/TikTok/YouTube, planos de marketing, finanças, investimentos e mais.

### 🎨 Imagina (381-480)
Geração de imagens com DALL-E 3. Digite "Imagina [descrição]" e a Kryno cria a imagem.

### 📷 Foto e Visão (481-540)
Envie uma foto e a Kryno descreve, lê texto, identifica objetos, plantas, animais, resolve questões e mais.

### 🎤 Áudio e Voz (541-580)
Transcrição de áudio, resumo, tradução, identificação de idioma com Whisper.

### 🍽️ Vida Real (581-620)
Receitas, treinos, dietas, dicas de filmes/séries/animes, roteiros de viagem, playlists e mais.

### 🔐 Login Google (601-620)
Login com Google OAuth, perfil, logout.

### 📜 Histórico (621-635)
Salvar, buscar, exportar e apagar conversas.

### 🛡️ Painel Admin (636-650)
Dashboard com estatísticas, gerenciar usuários, banir/desbanir, ver histórico de qualquer usuário.

## 📦 Deploy na Railway

### Passo a passo:

1. Crie uma conta em https://railway.app
2. Faça upload deste projeto para um repositório GitHub
3. Na Railway, clique em "New Project" → "Deploy from GitHub repo"
4. Selecione seu repositório
5. Configure as variáveis de ambiente:

```
OPENAI_API_KEY=sua-chave-openai
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_CALLBACK_URL=https://seu-dominio.railway.app/auth/google/callback
ADMIN_PASS=Kryno2026
ADMIN_PIN=1212
JWT_SECRET=sua-senha-secreta
```

6. A Railway vai instalar as dependências e iniciar o servidor automaticamente
7. Seu app estará no ar! 🔥

### Como obter as chaves:

**OpenAI API Key:**
- Acesse https://platform.openai.com/api-keys
- Crie uma nova chave

**Google OAuth:**
- Acesse https://console.cloud.google.com
- Crie um projeto → APIs & Services → Credentials
- Crie um OAuth 2.0 Client ID
- Adicione a URL de callback da Railway nas authorized redirect URIs

## 🛠️ Rodar localmente

```bash
npm install
cp .env.example .env  # Edite com suas chaves
node server.js
```

Acesse http://localhost:3000

## 🧱 Stack

- Node.js + Express
- SQLite (better-sqlite3)
- OpenAI API (GPT-4o, DALL-E 3, Whisper)
- Google OAuth
- HTML/CSS/JS (sem framework, puro e rápido)

## 🔑 Credenciais Admin padrão

- Senha: Kryno2026
- PIN: 1212

---

Feito com 🔥 por Kryno IA
