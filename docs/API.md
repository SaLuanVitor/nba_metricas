# NBA Métricas - Endpoints API

## Visão Geral

Base URL: `https://nba-metricas.vercel.app/api`

> **Nota**: Prefix com `http://localhost:3000/api` para desenvolvimento local.

---

## Autenticação

| Header | Descrição |
|--------|-----------|
| `Authorization` | `Bearer <token>` (se requerido) |
| `x-api-key` | API key para acesso público |

---

## Players

### Listar Jogadores

```
GET /players
```

**Parâmetros Query:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página atual |
| `limit` | number | 20 | Itens por página |
| `team` | string | - | Filtrar por time |
| `position` | string | - | Filtrar por posição (PG, SG, SF, PF, C) |
| `search` | string | - | Buscar por nome |
| `sort` | string | points | Ordenar por (points, assists, rebounds, fantasyPoints) |
| `order` | string | desc | Ordem (asc, desc) |

**Exemplo:**
```bash
curl "http://localhost:3000/api/players?limit=10&position=PG&sort=points"
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lebron-2544",
      "name": "LeBron James",
      "firstName": "LeBron",
      "lastName": "James",
      "number": 23,
      "position": "SF",
      "team": {
        "id": "lal",
        "name": "Lakers",
        "abbreviation": "LAL",
        "city": "Los Angeles"
      },
      "seasonStats": {
        "points": 25.7,
        "assists": 8.3,
        "rebounds": 7.3
      },
      "fantasyPoints": 48.5,
      "projection": {
        "projectedPoints": 26.5,
        "confidence": 85,
        "trend": "up"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "pages": 23
  }
}
```

---

### Detalhes do Jogador

```
GET /players/[id]
```

**Parâmetros:**
- `id` (path): ID do jogador

**Exemplo:**
```bash
curl http://localhost:3000/api/players/lebron-2544
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "lebron-2544",
    "name": "LeBron James",
    "firstName": "LeBron",
    "lastName": "James",
    "number": 23,
    "position": "SF",
    "team": { ... },
    "height": "6'9\"",
    "weight": 250,
    "age": 39,
    "experience": 21,
    "college": "St. Vincent-St. Mary HS",
    "imageUrl": "/players/lebron.jpg",
    "seasonStats": {
      "points": 25.7,
      "assists": 8.3,
      "rebounds": 7.3,
      "minutes": 35.3,
      "fieldGoalPercentage": 54.0,
      "threePointPercentage": 41.0,
      "freeThrowPercentage": 75.0,
      "steals": 1.3,
      "blocks": 0.5,
      "turnovers": 3.5
    },
    "last5Games": [...],
    "projection": {
      "projectedPoints": 26.5,
      "projectedAssists": 8.5,
      "projectedRebounds": 7.8,
      "projectedMinutes": 36.0,
      "confidence": 85,
      "trend": "up"
    },
    "fantasyPoints": 48.5,
    "salary": 9500,
    "injury": null
  }
}
```

---

### Estatísticas do Jogador

```
GET /players/[id]/stats
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "career": { ... },
    "season": { ... },
    "last10": { ... },
    "last5": { ... },
    "home": { ... },
    "away": { ... },
    "vsConference": { ... },
    "vsDivision": { ... }
  }
}
```

---

### Projeções do Jogador

```
GET /players/[id]/projections
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "playerId": "lebron-2544",
    "projectedPoints": 26.5,
    "projectedAssists": 8.5,
    "projectedRebounds": 7.8,
    "projectedMinutes": 36.0,
    "confidence": 85,
    "trend": "up",
    "methodology": "Prediction Engine v1 heuristic baseline",
    "factors": [
      "Recent performance (last 5 games)",
      "Matchup analysis",
      "Injury status",
      "Rest days",
      "Home/away split"
    ]
  }
}
```

---

### Probabilidades Over/Under

```
GET /players/[id]/probabilities
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "playerId": "lebron-2544",
    "overUnder": {
      "points": {
        "line": 25.5,
        "over": {
          "probability": 68,
          "confidence": "high",
          "factors": [
            { "name": "Consistency", "impact": 15 },
            { "name": "Trend", "impact": 10 },
            { "name": "Matchup", "impact": 8 }
          ]
        },
        "under": { "probability": 32, "confidence": "high" }
      },
      "assists": { ... },
      "rebounds": { ... }
    },
    "doubleDouble": {
      "probability": 58,
      "confidence": "medium"
    },
    "tripleDouble": {
      "probability": 12,
      "confidence": "low"
    },
    "season30Plus": {
      "probability": 72,
      "confidence": "high"
    }
  }
}
```

---

## Teams

### Listar Times

```
GET /teams
```

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `conference` | string | Filtrar por conference (East, West) |
| `division` | string | Filtrar por divisão |

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lal",
      "name": "Lakers",
      "abbreviation": "LAL",
      "city": "Los Angeles",
      "conference": "West",
      "division": "Pacific",
      "primaryColor": "#552583",
      "secondaryColor": "#FDB927"
    }
  ]
}
```

---

### Detalhes do Time

```
GET /teams/[id]
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "lal",
    "name": "Lakers",
    "abbreviation": "LAL",
    "city": "Los Angeles",
    "conference": "West",
    "division": "Pacific",
    "primaryColor": "#552583",
    "secondaryColor": "#FDB927",
    "stats": {
      "wins": 35,
      "losses": 18,
      "pointsPerGame": 118.5,
      "assistsPerGame": 28.3,
      "reboundsPerGame": 45.2,
      "offensiveRating": 118.3,
      "defensiveRating": 112.5,
      "pace": 101.2
    },
    "rank": {
      "conference": 3,
      "overall": 5
    },
    "streak": "W3",
    "lastGames": ["W", "W", "W", "L", "W"]
  }
}
```

---

### Elenco do Time

```
GET /teams/[id]/roster
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lebron-2544",
      "name": "LeBron James",
      "number": 23,
      "position": "SF",
      "fantasyPoints": 48.5
    }
  ]
}
```

---

### Calendário do Time

```
GET /teams/[id]/schedule
```

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `season` | number | Temporada (padrão: atual) |

---

## Games

### Jogos de Hoje

```
GET /games/today
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0022400123",
      "homeTeam": { "id": "lal", "abbreviation": "LAL", "score": 98 },
      "awayTeam": { "id": "gsw", "abbreviation": "GSW", "score": 102 },
      "status": "live",
      "time": "Q4 2:30",
      "venue": "Chase Center",
      "date": "2026-04-09T19:30:00Z"
    }
  ]
}
```

---

### Jogos Ao Vivo

```
GET /games/live
```

---

### Detalhes do Jogo

```
GET /games/[id]
```

---

### Box Score

```
GET /api/games/[id]/boxscore
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "homeTeam": {
      "totalPoints": 118,
      "players": [
        { "name": "LeBron James", "points": 28, "assists": 8, "rebounds": 7 }
      ]
    },
    "awayTeam": { ... }
  }
}
```

---

## AI/ML

> Status atual: o motor de predicao e o `Prediction Engine v1`, um baseline heuristico auditavel. Ele nao deve ser descrito como XGBoost, neural network ou modelo treinado ate existir pipeline validado.

### Projeções do Dia

```
GET /ai/projections
```

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `date` | string | Data (YYYY-MM-DD) |
| `gameId` | string | Filtrar por jogo |

---

### Insights

```
GET /ai/insights
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "insight-1",
      "type": "player",
      "severity": "positive",
      "title": "LeBron James em Alta",
      "description": "Projecao de 26.5 pontos com 85% de confianca",
      "confidence": "high",
      "factors": ["Tendencia de alta", "Alta confianca"]
    }
  ]
}
```

---

### Acurácia do Modelo

```
GET /ai/accuracy
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "correct": 72,
      "total": 100,
      "accuracy": 72.0,
      "lastUpdated": "2026-04-09T00:00:00Z"
    },
    "byMetric": {
      "points": 76.2,
      "assists": 74.1,
      "rebounds": 73.8
    }
  }
}
```

---

## Agentes

### Listar Agentes

```
GET /agents
```

---

### Agente Específico

```
GET /agents/[id]
```

**Exemplo:**
```bash
curl http://localhost:3000/api/agents/player-lebron-2544
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "agent-lebron-2544",
    "type": "player",
    "entityId": "lebron-2544",
    "name": "LeBron James Analyst",
    "personality": {
      "style": "analytical",
      "expertise": ["scoring", "playmaking", "leadership"]
    },
    "knowledge": {
      "stats": { ... },
      "recentGames": [ ... ],
      "trends": { ... }
    },
    "analysis": {
      "strengths": ["Elite scorer", "Historic playmaker"],
      "weaknesses": ["Back-to-back fatigue"],
      "opportunities": ["High usage when AD out"],
      "threats": ["Load management"]
    },
    "lastUpdated": "2026-04-09T14:00:00Z"
  }
}
```

---

### Atualizar Agente

```
POST /agents/[id]/refresh
```

**Headers:**
- `Content-Type: application/json`

**Resposta:**
```json
{
  "success": true,
  "message": "Agent refreshed successfully",
  "updatedAt": "2026-04-09T14:30:00Z"
}
```

---

### Agente por Time

```
GET /agents/teams/[teamId]
```

---

### Agente por Jogador

```
GET /agents/players/[playerId]
```

---

## Sincronização

### Sync Completo

```
POST /sync/full
```

---

### Sync Jogadores

```
POST /sync/players
```

---

### Sync Times

```
POST /sync/teams
```

---

### Sync Jogos

```
POST /sync/games
```

---

## Health Check

## Predicoes Auditaveis

### Predicoes de Hoje

```
GET /predictions/today
```

Retorna jogos do dia e props candidatas com `predictionId`, `probability`, `confidence`, `edge`, `expectedValue`, `riskLevel`, `reasons` e `auditUrl`.

### Auditoria de Predicao

```
GET /predictions/[id]
```

Retorna `inputSnapshot`, `output`, `modelVersion`, status de settlement e outcome quando existir.

### Model Runs

```
GET /model-runs
```

Lista a versao ativa do Prediction Engine v1 e metricas conhecidas a partir de outcomes liquidados.

### Acuracia

```
GET /accuracy
GET /ai/accuracy
```

Usa `prediction_outcomes` quando houver dados liquidados. Sem outcomes, retorna sample size zero com aviso.

---

## Health Check

### Health Geral

```
GET /health
```

**Resposta:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-09T14:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "externalApi": "healthy"
  }
}
```

---

### Health DB

```
GET /health/db
```

---

### Health Cache

```
GET /health/cache
```

---

### Health External

```
GET /health/external
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint | Limite |
|----------|--------|
| `/players` | 100/min |
| `/teams` | 60/min |
| `/games` | 60/min |
| `/ai/*` | 30/min |
| `/sync/*` | 10/min |

---

## Exemplos de Uso

### JavaScript

```javascript
const API_BASE = 'http://localhost:3000/api';

// Listar jogadores
const players = await fetch(`${API_BASE}/players?position=PG`)
  .then(r => r.json());

// Detalhes do jogador
const player = await fetch(`${API_BASE}/players/lebron-2544`)
  .then(r => r.json());

// Projeções
const projections = await fetch(`${API_BASE}/players/lebron-2544/projections`)
  .then(r => r.json());
```

### Python

```python
import requests

BASE_URL = 'http://localhost:3000/api'

# Listar jogadores
response = requests.get(f'{BASE_URL}/players?position=PG')
data = response.json()

# Atualizar agente
response = requests.post(
    f'{BASE_URL}/agents/player-lebron-2544/refresh',
    headers={'Content-Type': 'application/json'}
)
```
