# Deploy no Railway (Next.js + Postgres)

## 1) Serviços
1. Crie um projeto no Railway.
2. Adicione o serviço **PostgreSQL**.
3. Adicione o serviço da app via **Deploy from GitHub**.

## 2) Configuração de variáveis (App Service)
Use as variáveis de `.env.example` como base e configure no Railway:

- Obrigatórias:
  - `AUTH_SECRET`
  - `MASTER_EMAIL`
  - `MASTER_PASSWORD`
  - `MASTER_NAME`
  - `DATABASE_URL` (ideal: `${{Postgres.DATABASE_URL}}`)
  - `BALLDONTLIE_API_KEY`

- Recomendadas:
  - `APP_TIMEZONE=America/Bahia`
  - `NBA_SEASON=2025-26`
  - `STATUS_CONFIDENCE_MIN_SAFE=70`
  - `STATUS_CONFIDENCE_TARGET=80`

- Opcionais:
  - `BOLTODDS_API_KEY`
  - `NBA_STATS_BASE_URL`
  - `NBA_STATS_USER_AGENT`
  - `NBA_STATS_REFERER`
  - `NBA_STATS_TIMEOUT_MS`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`

## 3) `railway.json`
Este projeto já inclui `railway.json` com:
- builder `NIXPACKS`
- start `npm run start`
- healthcheck em `/api/health`

## 4) Validar após deploy
Abra no domínio público:

1. `/api/health`
   - `providers.balldontlie` deve estar `configured`
   - `providers.database` deve estar `configured`
2. `/login`
   - login master com `MASTER_EMAIL` e `MASTER_PASSWORD`
3. `/api/players`
   - `source` não deve ser `none` em cenário saudável
4. `/api/teams` e `/api/games/today`

## 5) Diagnóstico rápido sem dados
Se a UI subir mas vier vazia:
1. confira `/api/health`
2. confira `missingRequiredEnv` no payload de health
3. confira logs Railway por:
   - `UPSTREAM_UNAUTHORIZED`
   - `UPSTREAM_RATE_LIMIT`
   - `PROVIDER_FETCH_THROWN`
   - `Providers unavailable`

## 6) Observações importantes
- No Railway, **não** use host `db:5432` em `DATABASE_URL` (isso é local/docker-compose).
- Use sempre `DATABASE_URL` do próprio serviço Postgres Railway.
