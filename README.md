# 🔥 Kryno IA

Sua inteligência artificial completa. Chat, estudos, trabalho, imagens, áudio, histórico e painel admin — tudo em um só app.

## 🚀 Funcionalidades

1. 💬 Chat e Conversa (conselhos, cantadas, textos, legendas, nomes, memes...)
2. 📚 Estudos (matemática, física, química, resumos, redação ENEM...)
3. 💼 Trabalho e Grana (currículo, e-mails, propostas, roteiros, finanças...)
4. 🎨 Imagina - Geração de Imagens (Pollinations.ai - GRATUITO)
5. 📷 Foto e Visão (análise de imagens)
6. 🎤 Áudio e Voz (transcrição com Groq Whisper)
7. 🍽️ Vida Real (receitas, treinos, dietas, dicas, viagens...)
8. 🔐 Login Google (OAuth)
9. 📜 Histórico (salvar, buscar, exportar conversas)
10. 🛡️ Painel Admin (dashboard, banir usuários, estatísticas)

## 🧱 Stack

1. Node.js + Express
2. **PostgreSQL (Neon)** - banco de dados na nuvem (gratuito)
3. **Groq API** - chat (Llama 3.3 70B) e áudio (Whisper)
4. **Pollinations.ai** - geração de imagens (gratuito, sem chave)
5. Google OAuth (login opcional)
6. HTML/CSS/JS puro (sem framework)

## 📦 Deploy na Vercel

### Passo 1: Criar banco no Neon (GRATUITO)

1. Acesse https://neon.tech
2. Crie uma conta
3. Crie um novo projeto
4. Copie a "Connection string" (algo como `postgres://user:pass@host/db?sslmode=require`)

### Passo 2: Deploy na Vercel

1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Importe o repositório do GitHub
4. Configure as variáveis de ambiente:

```
GROQ_API_KEY=sua-chave-groq
DATABASE_URL=sua-connection-string-do-neon
ADMIN_PASS=Kryno2026
ADMIN_PIN=1212
JWT_SECRET=kryno2026secreto
NODE_ENV=production
```

Opcionais (login Google):
```
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_CALLBACK_URL=https://seu-app.vercel.app/auth/google/callback
```

5. Clique em "Deploy"
6. Pronto! 🔥

### Passo 3: Obter chaves

**Groq (GRATUITO):**
1. https://console.groq.com/keys
2. Create API Key
3. Copie e cole na variável GROQ_API_KEY

**Neon Postgres (GRATUITO):**
1. https://neon.tech
2. Crie projeto
3. Copie a connection string
4. Cole na variável DATABASE_URL

**Google OAuth (opcional):**
1. https://console.cloud.google.com
2. APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web Application)
4. Adicione a URL de callback: https://seu-app.vercel.app/auth/google/callback

## 🛠️ Rodar localmente

```bash
npm install
cp .env.example .env
# Edite o .env com suas chaves
node server.js
```

Acesse http://localhost:3000

## 🔑 Credenciais Admin

1. Senha: Kryno2026
2. PIN: 1212

## 💰 Custos

1. Groq: Tier gratuito generoso
2. Neon Postgres: Plano grátis (0.5 GB)
3. Pollinations.ai: Gratuito
4. Vercel: Plano grátis
5. Google OAuth: Gratuito

*Tudo funciona no gratuito!*

---

Feito com 🔥 por Kryno IA
