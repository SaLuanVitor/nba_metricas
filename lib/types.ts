// Tipos para a plataforma de dados NBA

export type Position = "PG" | "SG" | "SF" | "PF" | "C"

export type Team = {
  id: string
  name: string
  abbreviation: string
  city: string
  conference: "East" | "West"
  division: string
  primaryColor: string
  secondaryColor: string
}

export type TeamStats = {
  wins: number
  losses: number
  pointsPerGame: number
  assistsPerGame: number
  reboundsPerGame: number
  stealsPerGame: number
  blocksPerGame: number
  turnoversPerGame: number
  fieldGoalPercentage: number
  threePointPercentage: number
  freeThrowPercentage: number
  offensiveRating: number
  defensiveRating: number
  pace: number
}

export type TeamWithStats = Team & {
  stats: TeamStats
  streak: string
  lastGames: ("W" | "L")[]
  rank: {
    conference: number
    overall: number
  }
  record?: {
    winPct: number
    gamesPlayed: number
    last10: string
    streak: string
  }
}

export type PlayerStats = {
  points: number
  assists: number
  rebounds: number
  minutes: number
  fieldGoalPercentage: number
  threePointPercentage: number
  freeThrowPercentage: number
  steals: number
  blocks: number
  turnovers: number
}

export type PlayerProjection = {
  projectedPoints: number
  projectedAssists: number
  projectedRebounds: number
  projectedMinutes: number
  confidence: number // 0-100
  trend: "up" | "down" | "stable"
}

export type Player = {
  id: string
  name: string
  firstName: string
  lastName: string
  number: number
  position: Position
  team: Team
  height: string
  weight: number
  age: number
  experience: number
  college: string
  imageUrl: string
  seasonStats: PlayerStats
  last5Games: PlayerStats[]
  projection: PlayerProjection
  fantasyPoints: number
  salary: number
  injury?: {
    status: "Out" | "Questionable" | "Probable" | "Day-to-Day"
    description: string
  }
}

export type Game = {
  id: string
  homeTeam: Team
  awayTeam: Team
  date: string
  time: string
  status: "scheduled" | "live" | "final"
  homeScore?: number
  awayScore?: number
  venue: string
}

export type StatCategory = "points" | "assists" | "rebounds" | "minutes"

export type SortDirection = "asc" | "desc"

export type FilterOptions = {
  team?: string
  position?: Position
  minProjectedPoints?: number
  maxProjectedPoints?: number
}

// ============================================
// TIPOS PARA SISTEMA DE IA E ANALYTICS
// ============================================

export type ConfidenceLevel = "very-low" | "low" | "medium" | "high" | "very-high"

export type TrendDirection = "strong-up" | "up" | "stable" | "down" | "strong-down"

export type Probability = {
  value: number // 0-100
  confidence: ConfidenceLevel
  factors: ProbabilityFactor[]
}

export type ProbabilityFactor = {
  name: string
  impact: number // -100 a +100
  weight: number // 0-1
  description: string
}

export type PlayerProbabilities = {
  playerId: string
  overUnder: {
    points: { line: number; overProb: Probability; underProb: Probability }
    assists: { line: number; overProb: Probability; underProb: Probability }
    rebounds: { line: number; overProb: Probability; underProb: Probability }
    minutes: { line: number; overProb: Probability; underProb: Probability }
  }
  doubleDouble: Probability
  tripleDouble: Probability
  season30Plus: Probability
}

export type MatchupPrediction = {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  homeWinProb: Probability
  awayWinProb: Probability
  predictedSpread: number
  predictedTotal: number
  keyFactors: ProbabilityFactor[]
  playerMatchups: PlayerMatchup[]
}

export type PlayerMatchup = {
  player1Id: string
  player2Id: string
  advantage: "player1" | "player2" | "even"
  advantageScore: number // 0-100
  keyMetrics: string[]
}

export type SimulationResult = {
  simulationId: string
  iterations: number
  outcomes: SimulationOutcome[]
  distribution: {
    min: number
    max: number
    mean: number
    median: number
    stdDev: number
    percentiles: Record<number, number>
  }
}

export type SimulationOutcome = {
  value: number
  probability: number
  frequency: number
}

export type AIInsight = {
  id: string
  type: "player" | "team" | "matchup" | "trend" | "alert"
  severity: "info" | "warning" | "positive" | "negative"
  title: string
  description: string
  confidence: ConfidenceLevel
  relatedEntityId?: string
  relatedEntityType?: "player" | "team" | "game"
  timestamp: Date
  factors: string[]
}

export type ExpertAnalysis = {
  expertType: "player" | "team" | "matchup"
  entityId: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  recommendation: string
  confidenceScore: number
}

export type PerformanceHeatmap = {
  playerId: string
  metric: StatCategory
  data: HeatmapCell[][]
}

export type HeatmapCell = {
  value: number
  label: string
  isHighlight: boolean
}

export type TrendAnalysis = {
  entityId: string
  entityType: "player" | "team"
  metric: StatCategory
  direction: TrendDirection
  magnitude: number // percentual de mudanca
  period: string
  dataPoints: { date: string; value: number }[]
  prediction: { date: string; value: number }[]
}
