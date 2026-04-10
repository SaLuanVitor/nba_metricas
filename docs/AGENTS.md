# NBA Métricas - AI Agents Documentation

## Overview

The NBA Métricas platform features a sophisticated multi-agent AI system that provides specialized analysis for every NBA team and player. Each agent operates as an independent analytical unit with its own knowledge base, personality traits, and update mechanisms.

---

## Agent Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT ORCHESTRATION LAYER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │  Orchestrator    │───▶│  Update Manager  │───▶│  Knowledge Base  │     │
│  │  (triggers)      │    │  (scheduling)    │    │  (storage)       │     │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    TEAM AGENTS      │  │   PLAYER AGENTS     │  │   GLOBAL AGENTS     │
│      (30 agents)    │  │    (500+ agents)    │  │     (special)       │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ • Lakers Expert     │  │ • LeBron Analyst    │  │ • League Trends     │
│ • Celtics Expert    │  │ • Curry Analyst     │  │ • Matchup Finder    │
│ • Warriors Expert   │  │ • Jokic Analyst     │  │ • Injury Watcher    │
│ • ... (27 more)     │  │ • ... (497 more)    │  │ • Odds Scanner      │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### Agent Types

#### 1. Team Agents (30 total)
Each NBA team has a dedicated agent that analyzes:
- Team performance metrics
- Rotational patterns
- Matchup strengths/weaknesses
- Historical records against opponents
- Injury impacts on team dynamics

#### 2. Player Agents (500+ total)
Each player has an individual agent that tracks:
- Statistical performance trends
- Game-by-game output
- Matchup analysis
- Injury history and status
- Contract and fantasy value

#### 3. Global Agents (specialized)
- **League Trends Agent**: Analyzes league-wide patterns
- **Matchup Finder Agent**: Identifies favorable matchups
- **Injury Watcher Agent**: Monitors injury updates across league
- **Odds Scanner Agent**: Detects value in betting lines

---

## Agent Structure

### Base Agent Interface

```typescript
interface NBAAgent {
  // Identity
  id: string;
  type: 'team' | 'player' | 'global';
  entityId: string;
  name: string;
  
  // Knowledge Base
  knowledge: KnowledgeBase;
  
  // Personalization
  personality?: AgentPersonality;
  
  // Update Triggers
  triggers: UpdateTriggers;
  
  // Capabilities
  capabilities: AgentCapabilities;
  
  // Metadata
  lastUpdated: Date;
  version: string;
  confidence: number;
}

interface KnowledgeBase {
  // Statistics
  stats: PlayerStats | TeamStats;
  
  // Recent Performance
  recentGames: Game[];
  last10Games: Game[];
  last5Games: Game[];
  
  // Trends
  trends: TrendData;
  
  // Context
  injuries: Injury[];
  matchups: MatchupHistory[];
  
  // External
  news: NewsItem[];
  articles: Article[];
}

interface UpdateTriggers {
  onGameEnd: boolean;        // Update after each game
  onInjuryUpdate: boolean;   // Update when injury status changes
  onNews: boolean;           // Update when news breaks
  onLineupChange: boolean;   // Update when lineups are announced
  scheduled: string;         // Cron expression for scheduled updates
  manual: boolean;           // Allow manual refresh via UI
}

interface AgentCapabilities {
  generateProjection(): Projection;
  generateProbabilities(): Probabilities;
  generateInsights(): Insight[];
  analyzeMatchup(opponent: string): MatchupAnalysis;
  comparePlayer(targetId: string): PlayerComparison;
  generateReport(): AgentReport;
}
```

### Team Agent Structure

```typescript
interface TeamAgent extends NBAAgent {
  type: 'team';
  
  // Team-specific knowledge
  knowledge: TeamKnowledgeBase;
  
  // Analysis capabilities
  capabilities: TeamAgentCapabilities;
  
  // Team personality
  personality: TeamPersonality;
}

interface TeamKnowledgeBase extends KnowledgeBase {
  stats: TeamStats;
  
  // Team-specific
  roster: Player[];
  startingLineup: Player[];
  rotationOrder: RotationSlot[];
  
  // Advanced metrics
  offensiveRating: number;
  defensiveRating: number;
  netRating: number;
  pace: number;
  
  // Situational
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
  last10Record: { wins: number; losses: number };
  streak: string;
  
  // Matchup data
  vsConference: ConferenceRecord;
  vsDivision: DivisionRecord;
  headToHead: Record<string, { wins: number; losses: number }>;
}

interface TeamAgentCapabilities {
  predictGameOutcome(opponentId: string): GamePrediction;
  analyzeStrengths(): string[];
  analyzeWeaknesses(): string[];
  identifyKeyMatchups(): KeyMatchup[];
  generateGamePlan(opponentId: string): GamePlan;
  projectSeasonRecord(): { wins: number; losses: number };
}

interface TeamPersonality {
  // Playing style
  style: 'fast-paced' | 'half-court' | 'defensive' | 'balanced';
  
  // Expertise areas
  expertise: string[];
  
  // Focus areas for analysis
  focus: string[];
  
  // Descriptive traits
  descriptors: string[];
}
```

### Player Agent Structure

```typescript
interface PlayerAgent extends NBAAgent {
  type: 'player';
  
  knowledge: PlayerKnowledgeBase;
  
  capabilities: PlayerAgentCapabilities;
  
  personality?: PlayerPersonality;
}

interface PlayerKnowledgeBase extends KnowledgeBase {
  stats: PlayerStats;
  
  // Player-specific
  position: Position;
  height: string;
  weight: number;
  age: number;
  experience: number;
  
  // Performance breakdown
  homeStats: SplitStats;
  awayStats: SplitStats;
  vsConference: SplitStats;
  vsDivision: SplitStats;
  last10Stats: SplitStats;
  last5Stats: SplitStats;
  
  // Situational
  clutchPerformance: ClutchStats;
  firstHalfVsSecondHalf: SplitPerformance;
  
  // Fantasy
  fantasyPoints: number;
  salary: number;
  value: number;
  
  // Injury history
  injuryHistory: InjuryRecord[];
  currentInjury: Injury | null;
}

interface PlayerAgentCapabilities {
  generateProjection(metric: string): Projection;
  calculateOverUnder(line: number, metric: string): Probability;
  identifyHotStreaks(): StreakAnalysis;
  analyzeMatchupVsPosition(opponentTeam: string): MatchupAnalysis;
  projectDoubleDouble(): Probability;
  projectTripleDouble(): Probability;
  calculateFantasyValue(): ValueAnalysis;
}

interface PlayerPersonality {
  // Playing style
  style: 'scorer' | 'playmaker' | 'defender' | 'rebounder' | 'two-way' | 'versatile';
  
  // Strengths
  strengths: string[];
  
  // Weaknesses
  weaknesses: string[];
  
  // Best scenarios
  bestSituations: string[];
  
  // Worst scenarios
  worstSituations: string[];
}
```

---

## Agent Personalities by Team

### Western Conference

#### Los Angeles Lakers
```json
{
  "id": "agent-lal",
  "name": "Lakers Expert Agent",
  "personality": {
    "style": "fast-paced",
    "expertise": ["transition offense", "paint protection", "LeBron usage"],
    "focus": ["AD rim protection", "role players consistency", "injury management"],
    "descriptors": ["championship pedigree", "star-driven", "veteran leadership"]
  },
  "analysis": {
    "strengths": [
      "Elite star power (LeBron, AD)",
      "Championship experience",
      "High basketball IQ",
      "Strong home court advantage"
    ],
    "weaknesses": [
      "Age-related load management",
      "Injury concerns with key players",
      "Depth limitations",
      "Shooting inconsistency"
    ],
    "keyMetrics": {
      "paintPointsPct": 0.42,
      "transitionPts": 14.2,
      "pointsInPaintAllowed": 48.5,
      "defensiveRating": 112.3
    }
  }
}
```

#### Golden State Warriors
```json
{
  "id": "agent-gsw",
  "name": "Warriors Expert Agent",
  "personality": {
    "style": "motion-offense",
    "expertise": ["three-point shooting", "ball movement", "spacing"],
    "focus": ["Curry minutes management", "Klay recovery", "youth development"],
    "descriptors": ["dynasty legacy", "shooting excellence", "smart basketball"]
  }
}
```

#### Denver Nuggets
```json
{
  "id": "agent-den",
  "name": "Nuggets Expert Agent",
  "personality": {
    "style": "half-court",
    "expertise": ["Jokic usage", "post play", "clock management"],
    "focus": ["MPJ health", "Gordon scoring", "bench production"],
    "descriptors": ["champion DNA", "Jokic-centric", "execution excellence"]
  }
}
```

### Eastern Conference

#### Boston Celtics
```json
{
  "id": "agent-bos",
  "name": "Celtics Expert Agent",
  "personality": {
    "style": "balanced",
    "expertise": ["shooting", "versatility", "team defense"],
    "focus": ["Tatum consistency", "Porzingis health", "rotation balance"],
    "descriptors": ["historic franchise", "depth excellence", "shooting gallery"]
  }
}
```

#### Miami Heat
```json
{
  "id": "agent-mia",
  "name": "Heat Expert Agent",
  "personality": {
    "style": "defensive",
    "expertise": ["defensive schemes", "player development", "culture"],
    "focus": ["Butler availability", "young talent growth", "playoff push"],
    "descriptors": ["culture of excellence", "developmental powerhouse", "toughness"]
  }
}
```

---

## Agent Examples by Player

### LeBron James Agent

```json
{
  "id": "agent-player-lebron-2544",
  "type": "player",
  "entityId": "lebron-2544",
  "name": "LeBron James Analyst",
  
  "personality": {
    "style": "versatile",
    "strengths": [
      "Elite playmaking (8.3 APG)",
      "Historic scoring ability",
      "Versatility positionless",
      "Basketball IQ",
      "Clutch performance"
    ],
    "weaknesses": [
      "Back-to-back fatigue",
      "Defensive effort variability",
      "Age-related load management"
    ],
    "bestSituations": [
      "High usage with shooters spacing",
      "Pick-and-roll with big man",
      "Fast transition opportunities"
    ],
    "worstSituations": [
      "Back-to-back games",
      "Without reliable shooters",
      "Against elite rim protectors"
    ]
  },
  
  "knowledge": {
    "stats": {
      "points": 25.7,
      "assists": 8.3,
      "rebounds": 7.3,
      "minutes": 35.3,
      "fgPct": 54.0,
      "threePtPct": 41.0
    },
    "trends": {
      "points": "up",
      "assists": "stable",
      "rebounds": "up"
    },
    "projections": {
      "points": { "projected": 26.5, "confidence": 0.82 },
      "assists": { "projected": 8.5, "confidence": 0.78 },
      "rebounds": { "projected": 7.8, "confidence": 0.75 }
    },
    "probabilities": {
      "over22.5Points": 0.68,
      "over7.5Assists": 0.72,
      "doubleDouble": 0.58,
      "tripleDouble": 0.12
    }
  },
  
  "capabilities": {
    "projectionAccuracy": 0.82,
    "overUnderAccuracy": 0.76,
    "insightRelevance": 0.89,
    "lastAnalysisGenerated": "2026-04-09T14:00:00Z"
  }
}
```

### Stephen Curry Agent

```json
{
  "id": "agent-player-curry-201939",
  "type": "player",
  "entityId": "curry-201939",
  "name": "Stephen Curry Analyst",
  
  "personality": {
    "style": "scorer",
    "strengths": [
      "Elite three-point shooting",
      "Off-ball movement",
      "Free throw efficiency",
      "Clutch scoring"
    ],
    "weaknesses": [
      "Size limitation on defense",
      "Turnover prone",
      "Physical fatigue in playoffs"
    ]
  },
  
  "analysis": {
    "scoringProfile": {
      "catchAndShoot": { "points": 12.4, "percentage": 43.2 },
      "pullUp": { "points": 14.8, "percentage": 40.1 },
      "transition": { "points": 3.2, "percentage": 61.5 }
    }
  }
}
```

---

## Update Mechanisms

### Trigger Types

#### 1. Game-End Trigger
```typescript
// Update agent after each game
const gameEndTrigger = {
  enabled: true,
  delay: 300, // 5 minutes after game ends
  include: ['stats', 'trends', 'projections', 'insights'],
  exclude: []
};
```

#### 2. Injury Update Trigger
```typescript
const injuryTrigger = {
  enabled: true,
  monitor: ['player', 'team'],
  alerts: ['new-injury', 'status-change', 'return-date', 'outlook-change']
};
```

#### 3. Scheduled Trigger
```typescript
const scheduledTrigger = {
  enabled: true,
  schedule: '0 */6 * * *', // Every 6 hours
  priority: 'low',
  include: ['projections', 'trends', 'matchup-analysis']
};
```

#### 4. Manual Trigger (UI Button)
```typescript
// User clicks refresh button in UI
const manualTrigger = {
  enabled: true,
  requiresAuth: false,
  rateLimit: 10, // per hour
  clearCache: false
};
```

### Update Flow

```
User/Scheduler
      │
      ▼
┌─────────────────┐
│  Validate       │
│  Request        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fetch Latest   │────▶ NBA APIs
│  Data           │     (BallDontLie)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Process &      │
│  Normalize      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update Agent   │
│  Knowledge      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Run Analysis   │
│  Pipeline       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Generate New   │
│  Projections    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store & Cache  │
│  Results        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return to     │
│  Client        │
└─────────────────┘
```

---

## UI Integration

### Agent Refresh Button Component

```tsx
// components/agents/AgentRefreshButton.tsx
'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgentRefreshButtonProps {
  agentId: string;
  agentType: 'team' | 'player';
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function AgentRefreshButton({ 
  agentId, 
  agentType,
  onSuccess, 
  onError 
}: AgentRefreshButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/agents/${agentType === 'team' ? 'teams' : 'players'}/${agentId}/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh agent');
      }

      const data = await response.json();
      setLastUpdated(new Date(data.updatedAt));
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRefresh}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {loading ? 'Updating...' : 'Update Agent'}
      </Button>

      {lastUpdated && (
        <span className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </span>
      )}

      {error && (
        <span className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
```

### Usage in Player Detail Page

```tsx
// app/players/[id]/page.tsx
import { AgentRefreshButton } from '@/components/agents/AgentRefreshButton';
import { PlayerAgentCard } from '@/components/agents/PlayerAgentCard';

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const agentId = `player-${params.id}`;

  return (
    <div className="container py-8">
      {/* Player Info */}
      <PlayerInfoSection player={player} />

      {/* Agent Section */}
      <div className="mt-8 border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">AI Analysis Agent</h2>
          <AgentRefreshButton 
            agentId={params.id}
            agentType="player"
          />
        </div>
        
        <PlayerAgentCard agentId={agentId} />
      </div>

      {/* Stats & Projections */}
      <div className="mt-8">
        {/* ... */}
      </div>
    </div>
  );
}
```

---

## API Endpoints for Agents

### List All Agents

```
GET /api/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-lal",
      "type": "team",
      "entityId": "lal",
      "name": "Lakers Expert Agent",
      "lastUpdated": "2026-04-09T14:00:00Z",
      "confidence": 82
    }
  ],
  "total": 530
}
```

### Get Agent Details

```
GET /api/agents/[id]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent-player-lebron-2544",
    "type": "player",
    "entityId": "lebron-2544",
    "name": "LeBron James Analyst",
    "personality": {
      "style": "versatile",
      "strengths": [...],
      "weaknesses": [...]
    },
    "knowledge": {
      "stats": { ... },
      "trends": { ... },
      "recentGames": [...]
    },
    "analysis": {
      "strengths": [...],
      "weaknesses": [...],
      "opportunities": [...],
      "threats": [...]
    },
    "projections": {
      "points": { "projected": 26.5, "confidence": 0.82 },
      "assists": { "projected": 8.5, "confidence": 0.78 },
      "rebounds": { "projected": 7.8, "confidence": 0.75 }
    },
    "lastUpdated": "2026-04-09T14:00:00Z",
    "confidence": 82
  }
}
```

### Refresh Agent

```
POST /api/agents/[id]/refresh
```

**Response:**
```json
{
  "success": true,
  "message": "Agent refreshed successfully",
  "updatedAt": "2026-04-09T14:30:00Z",
  "updates": {
    "stats": true,
    "projections": true,
    "trends": true,
    "insights": true
  }
}
```

### Get Team Agent

```
GET /api/agents/teams/[teamId]
```

### Get Player Agent

```
GET /api/agents/players/[playerId]
```

### Get Agent Insights

```
GET /api/agents/[id]/insights
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "insight-1",
      "type": "projection",
      "severity": "positive",
      "title": "High Scoring Expected",
      "description": "Based on recent trends and matchup analysis",
      "confidence": "high",
      "timestamp": "2026-04-09T14:00:00Z"
    }
  ]
}
```

---

## Agent Training

### Initial Training

```typescript
async function trainInitialModel() {
  // Load historical data (3+ seasons)
  const historicalData = await loadHistoricalData({
    startSeason: '2022-23',
    endSeason: '2024-25',
    includePlayoffs: false
  });

  // Pre-process data
  const processedData = preprocessor.normalize(historicalData);

  // Train models
  const xgboostModel = await XGBoost.train(processedData, {
    objective: 'reg:squarederror',
    maxDepth: 6,
    learningRate: 0.1,
    nEstimators: 100
  });

  const neuralNetModel = await NeuralNetwork.train(processedData, {
    layers: [64, 32, 16],
    activation: 'relu',
    epochs: 50
  });

  // Save models
  await saveModels({
    xgboost: xgboostModel,
    neuralNet: neuralNetModel
  });
}
```

### Continuous Learning

```typescript
async function updateModelWithNewData() {
  // Fetch latest game data
  const recentGames = await fetchRecentGames({ days: 7 });

  // Evaluate current predictions
  const accuracy = await evaluatePredictions(recentGames);

  // If accuracy drops below threshold, retrain
  if (accuracy < 0.70) {
    await trainIncremental(recentGames);
  }

  // Update agent knowledge base
  await updateAllAgents();
}
```

---

## Performance Metrics

### Agent Accuracy Tracking

| Metric | Target | Current |
|--------|--------|---------|
| Projection Accuracy | >75% | 76.2% |
| Over/Under Correct | >70% | 72.4% |
| Trend Prediction | >80% | 78.5% |
| Insight Relevance | >85% | 89.2% |

### Confidence Scores

| Agent Type | Avg Confidence |
|------------|----------------|
| Team Agents | 78% |
| Player Agents | 82% |
| Global Agents | 85% |

---

## Troubleshooting

### Agent Not Updating

1. Check if trigger is enabled:
```bash
curl http://localhost:3000/api/agents/agent-id/triggers
```

2. Verify API connectivity:
```bash
curl http://localhost:3000/api/health/external
```

3. Check cache status:
```bash
curl http://localhost:3000/api/health/cache
```

### Stale Projections

1. Force refresh via UI button
2. Check last update timestamp:
```bash
curl http://localhost:3000/api/agents/agent-id | jq '.data.lastUpdated'
```

3. Verify scheduled jobs running:
- Check Vercel cron logs
- Verify KV (Redis) connectivity

### Low Confidence Scores

- More data needed: Wait for more games
- Inconsistent player: Expected for role players
- New to league: Rookie agents start with lower confidence
