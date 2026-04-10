# Data Providers Matrix

## Hybrid strategy
- `NBA Stats API` is the primary source for players, teams, season metrics, game logs, schedule, and boxscore.
- `BallDontLie` is contingency fallback for core NBA catalog and season averages.
- `BoltOdds` is specialized fallback for games and boxscore, and optional real-time odds/live feeds.

## What each API provides

### NBA Stats API (primary)
- Internal adapter: `lib/providers/nba-stats-provider.ts`
- Endpoints used:
  - `commonallplayers`
  - `leaguedashplayerstats`
  - `playergamelog`
  - `scoreboardv2`
  - `boxscoretraditionalv2`
  - `leaguedashteamstats`
  - `commonteamroster`
- Best for:
  - season player/team metrics
  - official game logs
  - NBA daily scoreboard
  - detailed official boxscore

### BallDontLie (contingency fallback)
- Internal adapter: `lib/providers/balldontlie-provider.ts`
- Endpoints used:
  - `/players`
  - `/season_averages`
  - `/teams`
  - `/games`
- Best for:
  - resilient fallback when NBA Stats is unavailable
  - basic players/teams catalog
  - basic game listing

### BoltOdds (specialized fallback)
- Internal adapter: `lib/providers/boltodds-provider.ts`
- Endpoints used:
  - `GET /api/get_games`
  - `POST /api/boxscores`
- Optional future:
  - Odds WebSocket stream
  - Live Scores stream
  - Play-by-play stream
- Best for:
  - fallback games listing
  - fallback game boxscore
  - odds and live market signals

## Fallback priority by internal endpoint

### Players
- `GET /api/players`: `nba-stats -> balldontlie`
- `GET /api/players/[id]`: `nba-stats -> balldontlie`
- `GET /api/players/[id]/stats`: `nba-stats -> balldontlie`

### Teams
- `GET /api/teams`: `nba-stats -> balldontlie`
- `GET /api/teams/[id]`: `nba-stats -> balldontlie`
- `GET /api/teams/[id]/roster`: `nba-stats -> balldontlie`

### Games
- `GET /api/games/today`: `nba-stats -> balldontlie -> boltodds`
- `GET /api/games/live`: `nba-stats -> balldontlie -> boltodds`
- `GET /api/games/[id]`: resolved from orchestrated games list
- `GET /api/games/[id]/boxscore`: `nba-stats -> boltodds`

## Response contract and observability
- Read endpoints always return `HTTP 200` with graceful degradation.
- Shared metadata:
  - `source`: `nba-stats | balldontlie | boltodds | none`
  - `sourceHealth`: `ok | degraded`
  - `cacheStatus`: `fresh | stale | rejected` (when available)
  - `warning?`
  - `errorCode?`
- `/api/players` also returns:
  - `statsCoverage`
  - `activePlayersCount`

## Environment variables
- `NBA_STATS_BASE_URL`
- `NBA_STATS_USER_AGENT`
- `NBA_STATS_REFERER`
- `NBA_STATS_TIMEOUT_MS`
- `BALLDONTLIE_API_KEY`
- `BOLTODDS_API_KEY`
