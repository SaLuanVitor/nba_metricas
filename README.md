# NBA Métricas Platform

Plataforma completa de análise e projeções NBA com agentes de IA especializados.

## 🚀 Quick Start

```bash
# Instalação
npm install

# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm run start
```

Acesse: http://localhost:3000

---

## 📋 Pré-requisitos

- Node.js 18+
- npm ou pnpm
- Conta no Vercel (para deploy)
- API Key BallDontLie (obrigatória para dados reais)

---

## 🛠️ Instalação Completa

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/nba_metricas.git
cd nba_metricas
```

### 2. Instale dependências

```bash
npm install
# ou
pnpm install
```

### 3. Configure variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite o `.env.local` com suas configurações:

```env
# Development
NBA_SEASON=2025-26
NODE_ENV=development
LOG_LEVEL=debug
```

### 4. Execute o projeto

```bash
npm run dev
```

Acesse http://localhost:3000

---

## 📦 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run start` | Inicia servidor de produção |
| `npm run lint` | Verifica código com ESLint |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run test` | Executa testes unitários |
| `npm run test:e2e` | Executa testes E2E com Playwright |
| `npm run test:coverage` | Gera relatório de cobertura |
| `npm run db:push` | Faz push do schema para banco |
| `npm run db:studio` | Abre Prisma Studio |

---

## 🌍 Ambientes

### Desenvolvimento Local

```bash
# .env.local
NBA_SEASON=2025-26
DATABASE_URL="postgres://localhost:5432/nba_metricas"
```

Execute:
```bash
npm run dev
# URL: http://localhost:3000
```

### Staging

```bash
# Deploy automático ao fazer push para branch 'staging'
# URL: https://nba-metricas-staging.vercel.app
```

Para fazer deploy manual:
```bash
vercel --prod --prebuilt --environment=staging
```

### Produção

```bash
# Criar tag de versão
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Deploy automático via GitHub Actions
# URL: https://nba-metricas.vercel.app
```

Deploy manual:
```bash
vercel --prod --prebuilt
```

---

## 🔧 Configuração de Banco de Dados

### Vercel Postgres

1. Acesse https://vercel.com/dashboard/databases
2. Create New Database → Vercel Postgres
3. Copie a URL de conexão

```env
DATABASE_URL="postgres://..."
```

### Schema

O schema está definido em `lib/db/schema.ts`. Para atualizar:

```bash
npm run db:push
```

---

## 🔐 Autenticação

### Setup NextAuth

1. Gere uma secret:

```bash
openssl rand -base64 32
```

2. Adicione ao `.env.local`:

```env
NEXTAUTH_SECRET="sua-secret-gerada"
NEXTAUTH_URL="http://localhost:3000"
```

3. (Opcional) Configure OAuth:

```env
GITHUB_ID="seu-github-id"
GITHUB_SECRET="seu-github-secret"
```

4. Acesse http://localhost:3000/api/auth/signin

---

## 📡 Sincronização de Dados

### Dados Disponíveis

| Dado | Endpoint | Frequência |
|------|----------|------------|
| Jogadores | `/api/sync/players` | 6h |
| Times | `/api/sync/teams` | 24h |
| Jogos | `/api/sync/games` | 1h |
| Projeções | `/api/ai/projections` | 6h |

### Sincronização Manual

```bash
# Sync completo
curl -X POST https://api.nba_metricas.com/api/sync/full

# Sync específico
curl -X POST https://api.nba_metricas.com/api/sync/players
curl -X POST https://api.nba_metricas.com/api/sync/teams
curl -X POST https://api.nba_metricas.com/api/sync/games
```

---

## 🧪 Testes

### Testes Unitários

```bash
npm run test
```

### Testes E2E

```bash
# Instale Playwright primeiro
npx playwright install

# Execute
npm run test:e2e
```

### Cobertura

```bash
npm run test:coverage
```

Relatório disponível em `coverage/`

---

## 🔍 Verificação de Saúde

Verifique o status da aplicação:

```bash
# Health geral
curl https://api.nba_metricas.com/api/health

# Status do banco
curl https://api.nba_metricas.com/api/health/db

# Status do cache
curl https://api.nba_metricas.com/api/health/cache

# Status das APIs externas
curl https://api.nba_metricas.com/api/health/external
```

---

## 📊 Endpoints Principais

### Jogadores
- `GET /api/players` - Lista todos
- `GET /api/players/[id]` - Detalhes
- `GET /api/players/[id]/stats` - Estatísticas
- `GET /api/players/[id]/projections` - Projeções IA

### Times
- `GET /api/teams` - Lista times
- `GET /api/teams/[id]` - Detalhes
- `GET /api/teams/[id]/stats` - Estatísticas

### Jogos
- `GET /api/games/today` - Jogos de hoje
- `GET /api/games/live` - Jogos ao vivo
- `GET /api/games/[id]` - Detalhes

### IA
- `GET /api/ai/projections` - Projeções do dia
- `GET /api/ai/insights` - Insights gerados
- `GET /api/ai/agents/[id]` - Agente específico

---

## 🤖 Agentes de IA

### Atualizar Agente via API

```bash
# Atualizar agente de jogador
curl -X POST https://api.nba_metricas.com/api/agents/players/lebron-2544/refresh

# Atualizar agente de time
curl -X POST https://api.nba_metricas.com/api/agents/teams/lal/refresh
```

### Agentes Disponíveis

| ID | Tipo | Entidade |
|----|------|----------|
| `agent-lebron-2544` | player | LeBron James |
| `agent-lal` | team | Los Angeles Lakers |
| `agent-gsw` | team | Golden State Warriors |
| ... | ... | ... |

---

## 📁 Estrutura do Projeto

```
nba_metricas/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (routes)/          # Páginas da app
│   └── layout.tsx         # Layout root
├── components/            # Componentes React
│   ├── ui/               # shadcn/ui
│   └── ...               # Componentes específicos
├── lib/                   # Código compartilhado
│   ├── nba-api/          # Cliente APIs NBA
│   ├── ai/               # Motor de IA
│   ├── db/               # Banco de dados
│   └── utils.ts          # Utilities
├── hooks/                 # React hooks
├── scripts/               # Scripts utilitários
├── docs/                 # Documentação
└── public/               # Arquivos estáticos
```

---

## 🆘 Troubleshooting

### Erro de conexão com banco

```bash
# Verificar URL de conexão
echo $DATABASE_URL

# Testar conexão
npm run db:studio
```

### Erro de autenticação

```bash
# Regenerar secret
openssl rand -base64 32

# Atualizar .env.local
```

### Cache não funciona

```bash
# Verificar configuração Redis
echo $KV_URL

# Limpar cache manualmente
curl -X POST /api/cache/clear
```

### API externa não responde

```bash
# Verificar chave API
echo $BALLDONTLIE_API_KEY

# Testar endpoint
curl -H "Authorization: Bearer $BALLDONTLIE_API_KEY" \
  https://api.balldontlie.io/v1/players
```

---

## 📝 Licença

MIT License - sinta-se livre para usar e modificar.

---

## 🙏 Agradecimentos

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://radix-ui.com)
- [BallDontLie](https://balldontlie.io)
