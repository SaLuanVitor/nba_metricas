import type { 
  Player, 
  TeamWithStats,
  SimulationResult, 
  SimulationOutcome,
  MatchupPrediction,
  PlayerMatchup,
  StatCategory
} from "./types"
import { getConfidenceLevel } from "./probability-engine"

// Gera numero aleatorio com distribuicao normal (Box-Muller)
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

// Gera simulação simplificada para dados da API
export function simulatePlayerMetricRaw(points: number, iterations: number = 5000): {
  mean: number; stdDev: number; median: number; p10: number; p90: number; distribution: { value: number; probability: number }[]
} {
  const mean = points
  const stdDev = Math.sqrt(points * 0.35)
  
  const results: number[] = []
  for (let i = 0; i < iterations; i++) {
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    results.push(Math.max(0, mean + z * stdDev))
  }
  
  results.sort((a, b) => a - b)
  const sum = results.reduce((a, b) => a + b, 0)
  const meanResult = sum / iterations
  const median = results[Math.floor(iterations / 2)]
  
  const bucketMap = new Map<number, number>()
  results.forEach(v => {
    const bucket = Math.round(v)
    bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1)
  })
  
  const distribution = Array.from(bucketMap.entries())
    .map(([value, frequency]) => ({ value, probability: (frequency / iterations) * 100 }))
    .sort((a, b) => a.value - b.value)
  
  return {
    mean: Math.round(meanResult * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    median: Math.round(median * 10) / 10,
    p10: results[Math.floor(iterations * 0.1)],
    p90: results[Math.floor(iterations * 0.9)],
    distribution: distribution.slice(0, 20)
  }
}

// Simula performance de um jogador para uma metrica
export function simulatePlayerMetric(
  player: Player,
  metric: StatCategory,
  iterations: number = 10000
): SimulationResult {
  const projection = player.projection
  const stats = player.seasonStats
  
  // Determina media e desvio padrao baseado na metrica
  let mean: number
  let stdDev: number
  
  switch (metric) {
    case "points":
      mean = projection.projectedPoints
      stdDev = Math.sqrt(mean * 0.35)
      break
    case "assists":
      mean = projection.projectedAssists
      stdDev = Math.sqrt(mean * 0.4)
      break
    case "rebounds":
      mean = projection.projectedRebounds
      stdDev = Math.sqrt(mean * 0.35)
      break
    case "minutes":
      mean = projection.projectedMinutes
      stdDev = Math.sqrt(mean * 0.15)
      break
    default:
      mean = stats.points
      stdDev = 5
  }
  
  // Ajusta por lesao
  if (player.injury) {
    if (player.injury.status === "Questionable") {
      mean *= 0.9
      stdDev *= 1.3
    } else if (player.injury.status === "Day-to-Day") {
      mean *= 0.95
      stdDev *= 1.15
    }
  }
  
  // Executa simulacoes
  const results: number[] = []
  for (let i = 0; i < iterations; i++) {
    const value = Math.max(0, randomNormal(mean, stdDev))
    results.push(Math.round(value * 10) / 10)
  }
  
  // Calcula estatisticas
  results.sort((a, b) => a - b)
  const sum = results.reduce((a, b) => a + b, 0)
  const meanResult = sum / iterations
  const median = results[Math.floor(iterations / 2)]
  const min = results[0]
  const max = results[iterations - 1]
  
  // Calcula desvio padrao dos resultados
  const sqDiffs = results.map(v => Math.pow(v - meanResult, 2))
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / iterations
  const resultStdDev = Math.sqrt(avgSqDiff)
  
  // Agrupa em outcomes (buckets de 1 unidade para points, 0.5 para outros)
  const bucketSize = metric === "points" ? 1 : 0.5
  const outcomeMap = new Map<number, number>()
  
  results.forEach(v => {
    const bucket = Math.round(v / bucketSize) * bucketSize
    outcomeMap.set(bucket, (outcomeMap.get(bucket) || 0) + 1)
  })
  
  const outcomes: SimulationOutcome[] = Array.from(outcomeMap.entries())
    .map(([value, frequency]) => ({
      value,
      frequency,
      probability: (frequency / iterations) * 100
    }))
    .sort((a, b) => a.value - b.value)
  
  // Percentis
  const percentiles: Record<number, number> = {
    5: results[Math.floor(iterations * 0.05)],
    10: results[Math.floor(iterations * 0.10)],
    25: results[Math.floor(iterations * 0.25)],
    50: median,
    75: results[Math.floor(iterations * 0.75)],
    90: results[Math.floor(iterations * 0.90)],
    95: results[Math.floor(iterations * 0.95)],
  }
  
  return {
    simulationId: `${player.id}-${metric}-${Date.now()}`,
    iterations,
    outcomes,
    distribution: {
      min,
      max,
      mean: Math.round(meanResult * 10) / 10,
      median: Math.round(median * 10) / 10,
      stdDev: Math.round(resultStdDev * 10) / 10,
      percentiles
    }
  }
}

// Simula um matchup entre dois times
export function simulateMatchup(
  homeTeam: TeamWithStats,
  awayTeam: TeamWithStats,
  homePlayers: Player[],
  awayPlayers: Player[],
  iterations: number = 5000
): MatchupPrediction {
  const homeWins: number[] = []
  const awayWins: number[] = []
  const spreads: number[] = []
  const totals: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    // Simula pontuacao do jogo
    const homeBase = homeTeam.stats.pointsPerGame
    const awayBase = awayTeam.stats.pointsPerGame
    
    // Ajuste de vantagem de casa (+3 pontos em media)
    const homeAdvantage = 3
    
    // Ajuste por rating ofensivo/defensivo
    const homeOffAdj = (homeTeam.stats.offensiveRating - 110) * 0.3
    const homeDefAdj = (110 - homeTeam.stats.defensiveRating) * 0.3
    const awayOffAdj = (awayTeam.stats.offensiveRating - 110) * 0.3
    const awayDefAdj = (110 - awayTeam.stats.defensiveRating) * 0.3
    
    const homeExpected = homeBase + homeAdvantage + homeOffAdj + awayDefAdj
    const awayExpected = awayBase + awayOffAdj + homeDefAdj
    
    const homeScore = Math.round(randomNormal(homeExpected, 12))
    const awayScore = Math.round(randomNormal(awayExpected, 12))
    
    if (homeScore > awayScore) homeWins.push(1)
    else awayWins.push(1)
    
    spreads.push(homeScore - awayScore)
    totals.push(homeScore + awayScore)
  }
  
  const homeWinPct = (homeWins.length / iterations) * 100
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / iterations
  const avgTotal = totals.reduce((a, b) => a + b, 0) / iterations
  
  // Analisa matchups de jogadores
  const playerMatchups: PlayerMatchup[] = []
  const positions = ["PG", "SG", "SF", "PF", "C"]
  
  positions.forEach(pos => {
    const homePlayer = homePlayers.find(p => p.position === pos)
    const awayPlayer = awayPlayers.find(p => p.position === pos)
    
    if (homePlayer && awayPlayer) {
      const homeScore = homePlayer.fantasyPoints + (homePlayer.projection.confidence * 0.3)
      const awayScore = awayPlayer.fantasyPoints + (awayPlayer.projection.confidence * 0.3)
      const diff = homeScore - awayScore
      
      playerMatchups.push({
        player1Id: homePlayer.id,
        player2Id: awayPlayer.id,
        advantage: diff > 5 ? "player1" : diff < -5 ? "player2" : "even",
        advantageScore: Math.abs(diff),
        keyMetrics: [
          `PPG: ${homePlayer.seasonStats.points.toFixed(1)} vs ${awayPlayer.seasonStats.points.toFixed(1)}`,
          `FP: ${homePlayer.fantasyPoints.toFixed(1)} vs ${awayPlayer.fantasyPoints.toFixed(1)}`
        ]
      })
    }
  })
  
  return {
    gameId: `${homeTeam.id}-${awayTeam.id}-${Date.now()}`,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeWinProb: {
      value: Math.round(homeWinPct),
      confidence: getConfidenceLevel(70),
      factors: [
        { name: "Vantagem de Casa", impact: 15, weight: 0.2, description: "+3 pontos em casa" },
        { name: "Rating Ofensivo", impact: homeTeam.stats.offensiveRating > awayTeam.stats.offensiveRating ? 10 : -10, weight: 0.25, description: `OFF: ${homeTeam.stats.offensiveRating.toFixed(1)}` },
        { name: "Rating Defensivo", impact: homeTeam.stats.defensiveRating < awayTeam.stats.defensiveRating ? 10 : -10, weight: 0.25, description: `DEF: ${homeTeam.stats.defensiveRating.toFixed(1)}` },
        { name: "Record", impact: homeTeam.stats.wins > awayTeam.stats.wins ? 10 : -5, weight: 0.15, description: `${homeTeam.stats.wins}-${homeTeam.stats.losses}` },
      ]
    },
    awayWinProb: {
      value: Math.round(100 - homeWinPct),
      confidence: getConfidenceLevel(70),
      factors: [
        { name: "Rating Ofensivo", impact: awayTeam.stats.offensiveRating > homeTeam.stats.offensiveRating ? 10 : -10, weight: 0.3, description: `OFF: ${awayTeam.stats.offensiveRating.toFixed(1)}` },
        { name: "Rating Defensivo", impact: awayTeam.stats.defensiveRating < homeTeam.stats.defensiveRating ? 10 : -10, weight: 0.3, description: `DEF: ${awayTeam.stats.defensiveRating.toFixed(1)}` },
        { name: "Record", impact: awayTeam.stats.wins > homeTeam.stats.wins ? 10 : -5, weight: 0.2, description: `${awayTeam.stats.wins}-${awayTeam.stats.losses}` },
      ]
    },
    predictedSpread: Math.round(avgSpread * 10) / 10,
    predictedTotal: Math.round(avgTotal * 10) / 10,
    keyFactors: [
      { name: "Pace", impact: Math.abs(homeTeam.stats.pace - awayTeam.stats.pace) > 3 ? 15 : 5, weight: 0.2, description: `${homeTeam.stats.pace.toFixed(1)} vs ${awayTeam.stats.pace.toFixed(1)}` },
      { name: "Rebotes", impact: homeTeam.stats.reboundsPerGame > awayTeam.stats.reboundsPerGame ? 10 : -10, weight: 0.15, description: `${homeTeam.stats.reboundsPerGame.toFixed(1)} vs ${awayTeam.stats.reboundsPerGame.toFixed(1)} RPG` },
    ],
    playerMatchups
  }
}

// Calcula probabilidade de um jogador atingir um valor especifico
export function calculateTargetProbability(
  simulation: SimulationResult,
  target: number,
  type: "over" | "under" | "exact"
): number {
  const { outcomes, distribution } = simulation
  
  if (type === "over") {
    const overOutcomes = outcomes.filter(o => o.value > target)
    return overOutcomes.reduce((sum, o) => sum + o.probability, 0)
  } else if (type === "under") {
    const underOutcomes = outcomes.filter(o => o.value < target)
    return underOutcomes.reduce((sum, o) => sum + o.probability, 0)
  } else {
    const exactOutcome = outcomes.find(o => Math.abs(o.value - target) < 0.5)
    return exactOutcome?.probability || 0
  }
}
