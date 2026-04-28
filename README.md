# NBA Metricas Platform

Plataforma Next.js para metricas, odds e predicoes auditaveis de NBA. O foco atual e servir um usuario analista/bettor com probabilidades, confianca, risco, fatores explicaveis e auditoria de previsoes.

## Estado Atual

- Next.js 16, React 19 e Tailwind CSS 4.
- API routes para players, teams, games, odds, AI, sync, auth e predictions.
- Providers: NBA Stats API, BallDontLie e BoltOdds.
- Postgres opcional para auth, snapshots, sync runs, odds snapshots e prediction registry.
- Prediction Engine v1: baseline heuristico auditavel. Nao e ML treinado, XGBoost ou neural network.
- Cache local `.cache` e mantido como fallback de desenvolvimento; em producao, Postgres deve ser a persistencia principal.

O roadmap completo esta em [`docs/NBA_METRICAS_EVOLUTION_PLAN.md`](docs/NBA_METRICAS_EVOLUTION_PLAN.md).

## Quick Start

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Scripts

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Build de producao, sem mascarar erros TypeScript |
| `npm run start` | Inicia o servidor de producao, usando standalone quando disponivel e fallback para `next start` |
| `npm run lint` | Executa ESLint flat config |
| `npm run typecheck` | Executa `tsc --noEmit` |
| `npm run test` | Gate minimo atual: typecheck |
| `npm run test:e2e` | Placeholder atual: typecheck ate Playwright real entrar |
| `npm run test:visual` | Placeholder atual: typecheck ate regressao visual real entrar |

## Variaveis Principais

Obrigatorias em producao:

```env
AUTH_SECRET=change-this-to-a-long-random-secret
MASTER_EMAIL=master@example.com
MASTER_PASSWORD=change-this-master-password
MASTER_NAME=Master User
DATABASE_URL=postgresql://...
BALLDONTLIE_API_KEY=...
SYNC_ADMIN_SECRET=change-this-sync-secret
CRON_REFRESH_SECRET=change-this-cron-secret
```

Recomendadas:

```env
APP_TIMEZONE=America/Bahia
NBA_SEASON=2025-26
NBA_STATS_BASE_URL=https://stats.nba.com/stats
NBA_STATS_USER_AGENT=...
NBA_STATS_REFERER=https://www.nba.com/
BOLTODDS_API_KEY=...
DEBUG_API_SECRET=change-this-debug-secret
```

## Banco de Dados

O projeto usa `pg` diretamente. A migracao operacional versionada inicial esta em:

```text
migrations/001_operational_schema.sql
```

As funcoes atuais ainda criam tabelas defensivamente em runtime para compatibilidade com ambientes existentes, mas o caminho recomendado e aplicar migracoes antes do deploy.

## Endpoints Principais

Dados NBA:

- `GET /api/players`
- `GET /api/teams`
- `GET /api/games/today`
- `GET /api/games/live`
- `GET /api/games/[id]/boxscore`

Predicoes auditaveis:

- `GET /api/predictions/today`
- `GET /api/predictions/[id]`
- `GET /api/model-runs`
- `GET /api/accuracy`
- `GET /api/ai/accuracy`

Operacao:

- `GET /api/health`
- `POST /api/sync` com `x-sync-secret` ou `Authorization: Bearer <SYNC_ADMIN_SECRET>` em producao
- `POST /api/cron/refresh` com bearer secret

Debug:

- `GET /api/debug` exige `DEBUG_API_SECRET` ou `SYNC_ADMIN_SECRET` em producao.

## Contrato de Resposta

Endpoints novos devem incluir:

```json
{
  "success": true,
  "data": {},
  "source": "nba-stats | balldontlie | boltodds | none",
  "sourceHealth": "ok | degraded",
  "cacheStatus": "fresh | stale | rejected",
  "warning": "optional",
  "errorCode": "optional",
  "generatedAt": "2026-04-28T00:00:00.000Z"
}
```

## Deploy Railway

Veja [`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md). Para producao, configure Postgres no Railway e use `DATABASE_URL` do proprio servico Postgres.

## Guardrails de Produto

- Mostrar probabilidade, confianca, risco e razoes.
- Evitar linguagem de certeza.
- Toda pick exibida deve ter ID auditavel quando Postgres estiver configurado.
- Acuracia deve ser baseada em outcomes liquidados, nao em comparacao com media da temporada.
