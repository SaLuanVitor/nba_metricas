# NBA Métricas Platform - Arquitetura do Sistema

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NBA MÉTRICAS PLATFORM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Frontend   │    │    API       │    │   Database   │              │
│  │   Next.js    │◄──►│   Routes     │◄──►│   Postgres   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Design     │    │    Cache     │    │   Agentes    │              │
│  │   System     │    │    Redis     │    │     AI       │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | Vercel Postgres (PostgreSQL) |
| **Cache** | Redis (Vercel KV) |
| **Auth** | NextAuth.js v5 |
| **IA/ML** | XGBoost, Neural Networks (Custom) |
| **Testing** | Vitest, Playwright |
| **Deploy** | Vercel |

## Arquitetura de Dados

### Fontes de Dados

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  BallDontLie  │    │   BallDontLie API   │    │    RotoWire     │
│  (stats, odds)  │    │  (stats, live)  │    │  (lineups, injuries)
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NBA API Client Layer                       │
│  - Rate limiting                                                 │
│  - Response caching                                              │
│  - Error handling                                                │
│  - Data normalization                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Schedule  │───►│   Fetch     │───►│   Process   │───►│   Store     │
│   (cron)    │    │   (API)     │    │   (ML/AI)   │    │   (DB/Cache)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Sync Schedule (6/6h ou sob demanda)              │
├───────────────────────────────────────────────────────────────────────┤
│  00:00 - Daily games sync                                           │
│  06:00 - Player stats update                                        │
│  12:00 - Team rankings update                                      │
│  18:00 - Pre-game projections                                      │
│  Real-time - Webhook for live games                                │
└───────────────────────────────────────────────────────────────────────┘
```

## Estrutura de Diretórios

```
nba_metricas/
├── app/                          # Next.js App Router
│   ├── (routes)/                 # rotas da aplicação
│   │   ├── players/              # /players/[id]
│   │   ├── teams/                # /teams/[id]
│   │   ├── games/                # /games/[id]
│   │   ├── ai/                   # /ai/projections
│   │   └── dashboard/            # /dashboard
│   ├── api/                      # API Routes
│   │   ├── auth/                 # NextAuth endpoints
│   │   ├── players/             # Player endpoints
│   │   ├── teams/                # Team endpoints
│   │   ├── games/               # Game endpoints
│   │   ├── ai/                  # AI/ML endpoints
│   │   └── sync/                # Data sync endpoints
│   └── layout.tsx               # Root layout
│
├── components/                   # Componentes React
│   ├── ui/                      # Componentes base (shadcn)
│   ├── players/                 # Componentes de jogadores
│   ├── teams/                   # Componentes de times
│   ├── games/                   # Componentes de jogos
│   ├── ai/                      # Componentes de IA
│   └── design-system/           # Componentes do design system
│
├── lib/                         # Código compartilhado
│   ├── nba-api/                # Cliente de APIs NBA
│   │   ├── client.ts           # NBA API client
│   │   ├── endpoints.ts        # Endpoint definitions
│   │   └── types.ts            # Tipos de resposta
│   ├── ai/                     # Motor de IA
│   │   ├── engine.ts           # Core ML engine
│   │   ├── models/             # Modelos ML
│   │   │   ├── xgboost.ts
│   │   │   ├── neural-network.ts
│   │   │   └── probability.ts
│   │   └── agents/             # Agentes especializados
│   │       ├── base-agent.ts
│   │       ├── team-agents.ts
│   │       └── player-agents.ts
│   ├── db/                     # Camada de banco
│   │   ├── client.ts           # DB client
│   │   ├── schema.ts           # Schema definitions
│   │   └── queries.ts          # DB queries
│   ├── cache/                  # Cache layer
│   │   └── redis.ts           # Redis client
│   └── utils.ts               # Utilities
│
├── hooks/                       # React hooks personalizados
│   ├── use-players.ts         # Hook para jogadores
│   ├── use-teams.ts           # Hook para times
│   ├── use-games.ts           # Hook para jogos
│   └── use-ai.ts              # Hook para IA
│
├── scripts/                     # Scripts utilitários
│   ├── sync/                  # Scripts de sincronização
│   │   ├── sync-players.ts
│   │   ├── sync-teams.ts
│   │   └── sync-games.ts
│   └── training/             # Scripts de treinamento ML
│       ├── train-model.ts
│       └── evaluate-model.ts
│
├── public/                     # Arquivos estáticos
│   └── images/                # Imagens (logos, placeholders)
│
└── styles/                     # Estilos globais
    └── globals.css
```

## Componentes Principais

### 1. NBA API Client

```typescript
// lib/nba-api/client.ts
class NBAPIClient {
  private baseUrl: string;
  private apiKey: string;
  private cache: Cache;
  
  async getPlayerStats(playerId: string): Promise<PlayerStats>;
  async getTeamStats(teamId: string): Promise<TeamStats>;
  async getGames(date: string): Promise<Game[]>;
  async getLiveScores(): Promise<LiveScore[]>;
}
```

### 2. AI Engine

```typescript
// lib/ai/engine.ts
class AIEngine {
  private models: Map<string, Model>;
  
  // Gera projeções usando ensemble de modelos
  generateProjection(player: Player): Projection;
  
  // Calcula probabilidades over/under
  calculateProbabilities(player: Player, line: number): Probability;
  
  // Treina modelos com dados históricos
  trainModels(historicalData: HistoricalData): void;
}
```

### 3. Agentes Especializados

```typescript
// lib/ai/agents/base-agent.ts
interface NBAAgent {
  id: string;
  type: 'team' | 'player';
  entityId: string;
  
  // Conhecimento do agente
  knowledge: KnowledgeBase;
  
  // Gatilhos de atualização
  triggers: Triggers;
  
  // Ações do agente
  generateAnalysis(): Analysis;
  generateProjection(): Projection;
  generateInsights(): Insight[];
}
```

## Banco de Dados

### Schema Principal

```sql
-- Players
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  nba_api_id INTEGER UNIQUE,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  team_id TEXT REFERENCES teams(id),
  height TEXT,
  weight INTEGER,
  age INTEGER,
  experience INTEGER,
  image_url TEXT,
  
  -- Stats da temporada atual
  points_avg DECIMAL(5,2),
  assists_avg DECIMAL(5,2),
  rebounds_avg DECIMAL(5,2),
  minutes_avg DECIMAL(5,2),
  fg_pct DECIMAL(5,2),
  three_pt_pct DECIMAL(5,2),
  ft_pct DECIMAL(5,2),
  
  -- injury status
  injury_status TEXT,
  injury_description TEXT,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  nba_api_id INTEGER UNIQUE,
  name TEXT,
  abbreviation TEXT,
  city TEXT,
  conference TEXT,
  division TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT
);

-- Team Stats
CREATE TABLE team_stats (
  team_id TEXT REFERENCES teams(id),
  season INTEGER,
  wins INTEGER,
  losses INTEGER,
  points_avg DECIMAL(5,2),
  assists_avg DECIMAL(5,2),
  rebounds_avg DECIMAL(5,2),
  offensive_rating DECIMAL(5,2),
  defensive_rating DECIMAL(5,2),
  pace DECIMAL(5,2),
  PRIMARY KEY (team_id, season)
);

-- Games
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  nba_api_id INTEGER UNIQUE,
  home_team_id TEXT REFERENCES teams(id),
  away_team_id TEXT REFERENCES teams(id),
  date TIMESTAMP,
  status TEXT,
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT,
  season INTEGER
);

-- Projections
CREATE TABLE projections (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  game_id TEXT REFERENCES games(id),
  projected_points DECIMAL(5,2),
  projected_assists DECIMAL(5,2),
  projected_rebounds DECIMAL(5,2),
  projected_minutes DECIMAL(5,2),
  confidence DECIMAL(5,2),
  trend TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  type TEXT, -- 'team' ou 'player'
  entity_id TEXT,
  knowledge JSONB,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

## Cache Strategy

### Redis Keys

```typescript
const CACHE_KEYS = {
  PLAYERS_LIST: 'players:list',
  PLAYER_DETAIL: (id: string) => `players:${id}`,
  PLAYER_STATS: (id: string) => `players:${id}:stats`,
  TEAMS_LIST: 'teams:list',
  TEAM_DETAIL: (id: string) => `teams:${id}`,
  TEAM_STATS: (id: string) => `teams:${id}:stats`,
  GAMES_TODAY: 'games:today',
  GAME_DETAIL: (id: string) => `games:${id}`,
  PROJECTIONS: (date: string) => `projections:${date}`,
  AI_INSIGHTS: 'ai:insights',
};
```

### TTL Strategy

| Dado | TTL |
|------|-----|
| Lista de jogadores | 6h |
| Estatísticas jogador | 3h |
| Lista de times | 24h |
| Jogos do dia | 1h |
| Projeções | 2h |
| Live scores | 30s |

## Autenticação

### Providers

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';

export const { handlers } = NextAuth({
  providers: [
    GitHub,
    Google,
  ],
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
  },
});
```

## Security

### Rate Limiting

```typescript
// lib/middleware/rate-limit.ts
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  
  // Stricter for write operations
  sync: {
    windowMs: 60 * 1000,
    max: 10,
  },
};
```

### API Key Protection

```typescript
// Middleware para validar API keys
export function withApiKey(handler: Handler) {
  return async (req: Request) => {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || !isValidKey(apiKey)) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handler(req);
  };
}
```

## Ambiente de Desenvolvimento

### Configuração Local

```bash
# .env.local
DATABASE_URL="postgres://..."
NEXTAUTH_SECRET="secret-key"
NEXTAUTH_URL="http://localhost:3000"

# API Keys (obter em https://BallDontLie.com)
BALLDONTLIE_API_KEY="your-key"

# BallDontLie API (gratuito, mas requer headers específicos)
BALLDONTLIE_API_URL="https://api.balldontlie.io/v1"

# Redis (desenvolvimento local)
REDIS_URL="redis://localhost:6379"
```

## Deploy

### Staging
- Branch: `staging`
- URL: `https://nba-metricas-staging.vercel.app`
- Trigger: Push para `staging`

### Produção
- Branch: `main`
- Tag: `v*.*.*`
- URL: `https://nba-metricas.vercel.app`
- Trigger: Nova tag versionada

## Monitoramento

### Health Checks

```
GET /api/health          # Health geral
GET /api/health/db       # Status do banco
GET /api/health/cache    # Status do cache
GET /api/health/external # Status das APIs externas
```

### Métricas

| Métrica | Target |
|---------|--------|
| API Latency | < 200ms |
| Cache Hit Rate | > 80% |
| Error Rate | < 1% |
| Uptime | 99.9% |

---

## Evolução do Sistema

### Fase 1 (Current)
- [x] Frontend Next.js
- [x] Dados reais de APIs
- [x] Componentes UI básicos

### Fase 2 (Próximo)
- [ ] Integração APIs NBA
- [ ] Database setup
- [ ] Cache layer
- [ ] API routes básicas

### Fase 3
- [ ] Sistema de Agentes IA
- [ ] Projeções com ML
- [ ] Autenticação
- [ ] Dashboard usuário

### Fase 4
- [ ] Treinamento de modelos
- [ ] Agentes especializados por time
- [ ] Atualização em tempo real
- [ ] APIs externas de betting
