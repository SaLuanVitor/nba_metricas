import type { 
  Player, 
  PlayerProbabilities, 
  Probability, 
  ProbabilityFactor, 
  ConfidenceLevel,
  StatCategory
} from "./types"

// Utilitarios de confianca
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 85) return "very-high"
  if (score >= 70) return "high"
  if (score >= 50) return "medium"
  if (score >= 30) return "low"
  return "very-low"
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  const colors: Record<ConfidenceLevel, string> = {
    "very-high": "text-emerald-400",
    "high": "text-green-400",
    "medium": "text-yellow-400",
    "low": "text-orange-400",
    "very-low": "text-red-400"
  }
  return colors[level]
}

export function getConfidenceBgColor(level: ConfidenceLevel): string {
  const colors: Record<ConfidenceLevel, string> = {
    "very-high": "bg-emerald-500/20 border-emerald-500/40",
    "high": "bg-green-500/20 border-green-500/40",
    "medium": "bg-yellow-500/20 border-yellow-500/40",
    "low": "bg-orange-500/20 border-orange-500/40",
    "very-low": "bg-red-500/20 border-red-500/40"
  }
  return colors[level]
}

// Calcula fatores de probabilidade para um jogador
function calculateFactors(player: Player, metric: StatCategory): ProbabilityFactor[] {
  const factors: ProbabilityFactor[] = []
  const stats = player.seasonStats
  const last5 = player.last5Games
  
  // Fator de consistencia (variancia nos ultimos 5 jogos)
  const metricKey = metric === "minutes" ? "minutes" : metric
  const values = last5.map(g => g[metricKey])
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  const consistency = Math.max(0, 100 - variance * 2)
  
  factors.push({
    name: "Consistencia Recente",
    impact: consistency > 70 ? 15 : consistency > 50 ? 5 : -10,
    weight: 0.25,
    description: `Variancia de ${variance.toFixed(1)} nos ultimos 5 jogos`
  })
  
  // Fator de tendencia
  const recentAvg = (values[0] + values[1]) / 2
  const olderAvg = (values[3] + values[4]) / 2
  const trendPct = ((recentAvg - olderAvg) / olderAvg) * 100
  
  factors.push({
    name: "Tendencia",
    impact: trendPct > 10 ? 20 : trendPct > 0 ? 10 : trendPct > -10 ? -5 : -15,
    weight: 0.2,
    description: trendPct > 0 ? `Em alta ${trendPct.toFixed(1)}%` : `Em baixa ${Math.abs(trendPct).toFixed(1)}%`
  })
  
  // Fator de minutos projetados
  const minutesFactor = player.projection.projectedMinutes / stats.minutes
  factors.push({
    name: "Minutos Projetados",
    impact: minutesFactor > 1.05 ? 15 : minutesFactor > 0.95 ? 5 : -10,
    weight: 0.2,
    description: `${player.projection.projectedMinutes.toFixed(1)} min esperados`
  })
  
  // Fator de lesao
  if (player.injury) {
    const injuryImpact = player.injury.status === "Out" ? -50 : 
                         player.injury.status === "Questionable" ? -20 :
                         player.injury.status === "Day-to-Day" ? -15 : -5
    factors.push({
      name: "Status de Lesao",
      impact: injuryImpact,
      weight: 0.35,
      description: `${player.injury.status}: ${player.injury.description}`
    })
  }
  
  return factors
}

// Calcula probabilidade para over/under de uma metrica
function calculateOverUnderProb(
  player: Player, 
  metric: StatCategory, 
  line: number
): { overProb: Probability; underProb: Probability } {
  const stats = player.seasonStats
  const projection = player.projection
  const factors = calculateFactors(player, metric)
  
  // Valor base projetado
  let projectedValue: number
  switch (metric) {
    case "points": projectedValue = projection.projectedPoints; break
    case "assists": projectedValue = projection.projectedAssists; break
    case "rebounds": projectedValue = projection.projectedRebounds; break
    case "minutes": projectedValue = projection.projectedMinutes; break
    default: projectedValue = stats.points
  }
  
  // Calcula probabilidade base
  const diff = projectedValue - line
  const stdDev = Math.sqrt(projectedValue * 0.3) // Estimativa de desvio padrao
  const zScore = diff / stdDev
  
  // Converte z-score para probabilidade (aproximacao)
  const baseOverProb = 50 + (Math.tanh(zScore * 0.5) * 45)
  
  // Aplica fatores
  const factorAdjustment = factors.reduce((sum, f) => sum + (f.impact * f.weight), 0)
  const adjustedOverProb = Math.min(95, Math.max(5, baseOverProb + factorAdjustment * 0.3))
  
  const confidenceScore = projection.confidence - (player.injury ? 15 : 0)
  const confidence = getConfidenceLevel(confidenceScore)
  
  return {
    overProb: {
      value: Math.round(adjustedOverProb),
      confidence,
      factors
    },
    underProb: {
      value: Math.round(100 - adjustedOverProb),
      confidence,
      factors
    }
  }
}

// Calcula probabilidade de double-double
function calculateDoubleDoubleProb(player: Player): Probability {
  const stats = player.seasonStats
  const projection = player.projection
  
  // Conta quantas categorias estao perto de 10+
  const categories = [
    { value: projection.projectedPoints, threshold: 10 },
    { value: projection.projectedAssists, threshold: 10 },
    { value: projection.projectedRebounds, threshold: 10 },
  ]
  
  const above10 = categories.filter(c => c.value >= 10).length
  const close = categories.filter(c => c.value >= 7 && c.value < 10).length
  
  let prob = 5 // Base
  if (above10 >= 2) prob = 65 + (above10 * 10)
  else if (above10 === 1 && close >= 1) prob = 35 + (close * 10)
  else if (close >= 2) prob = 15 + (close * 8)
  
  // Ajuste por historico (simplificado)
  const avgStats = (stats.points + stats.assists + stats.rebounds) / 3
  if (avgStats > 12) prob += 10
  
  return {
    value: Math.min(95, Math.max(5, Math.round(prob))),
    confidence: getConfidenceLevel(projection.confidence),
    factors: [
      { name: "Pontos Projetados", impact: projection.projectedPoints >= 10 ? 20 : -10, weight: 0.33, description: `${projection.projectedPoints.toFixed(1)} pts` },
      { name: "Assistencias Projetadas", impact: projection.projectedAssists >= 10 ? 20 : -10, weight: 0.33, description: `${projection.projectedAssists.toFixed(1)} ast` },
      { name: "Rebotes Projetados", impact: projection.projectedRebounds >= 10 ? 20 : -10, weight: 0.33, description: `${projection.projectedRebounds.toFixed(1)} reb` },
    ]
  }
}

// Calcula probabilidade de triple-double
function calculateTripleDoubleProb(player: Player): Probability {
  const projection = player.projection
  
  const categories = [
    projection.projectedPoints,
    projection.projectedAssists,
    projection.projectedRebounds,
  ]
  
  const above10 = categories.filter(v => v >= 10).length
  const above8 = categories.filter(v => v >= 8).length
  
  let prob = 1 // Base muito baixa
  if (above10 >= 3) prob = 35
  else if (above10 === 2 && above8 === 3) prob = 15
  else if (above10 === 2) prob = 5
  
  // Bonus para jogadores elite conhecidos
  if (player.fantasyPoints > 50) prob += 5
  
  return {
    value: Math.min(50, Math.max(1, Math.round(prob))),
    confidence: getConfidenceLevel(Math.max(40, projection.confidence - 20)),
    factors: [
      { name: "Versatilidade", impact: above10 * 15, weight: 0.5, description: `${above10} categorias acima de 10` },
      { name: "Fantasy Points", impact: player.fantasyPoints > 50 ? 10 : 0, weight: 0.3, description: `${player.fantasyPoints.toFixed(1)} FP` },
    ]
  }
}

// Gera probabilidades simplificadas para dados da API
export function generatePlayerProbabilitiesRaw(points: number): { under: number; over: number; push: number; line: number } {
  const line = Math.round(points * 2) / 2
  const variance = Math.sqrt(points * 0.3)
  const zScore = (points - line) / variance
  const overProb = Math.min(95, Math.max(5, Math.round(50 + Math.tanh(zScore * 0.5) * 40)))
  
  return {
    line,
    over: overProb,
    under: 100 - overProb,
    push: 0
  }
}

// Gera todas as probabilidades para um jogador
export function generatePlayerProbabilities(player: Player): PlayerProbabilities {
  const stats = player.seasonStats
  
  // Linhas baseadas na media da temporada (arredondadas para .5)
  const pointsLine = Math.round(stats.points * 2) / 2
  const assistsLine = Math.round(stats.assists * 2) / 2
  const reboundsLine = Math.round(stats.rebounds * 2) / 2
  const minutesLine = Math.round(stats.minutes * 2) / 2
  
  return {
    playerId: player.id,
    overUnder: {
      points: { line: pointsLine, ...calculateOverUnderProb(player, "points", pointsLine) },
      assists: { line: assistsLine, ...calculateOverUnderProb(player, "assists", assistsLine) },
      rebounds: { line: reboundsLine, ...calculateOverUnderProb(player, "rebounds", reboundsLine) },
      minutes: { line: minutesLine, ...calculateOverUnderProb(player, "minutes", minutesLine) },
    },
    doubleDouble: calculateDoubleDoubleProb(player),
    tripleDouble: calculateTripleDoubleProb(player),
    season30Plus: {
      value: Math.min(90, Math.max(10, Math.round(50 + (player.seasonStats.points - 25) * 5))),
      confidence: getConfidenceLevel(player.projection.confidence),
      factors: [
        { name: "Media de Pontos", impact: stats.points > 25 ? 20 : -10, weight: 0.5, description: `${stats.points.toFixed(1)} PPG` }
      ]
    }
  }
}

// Formata probabilidade para exibicao
export function formatProbability(prob: number): string {
  return `${prob}%`
}

// Retorna cor baseada na probabilidade
export function getProbabilityColor(prob: number): string {
  if (prob >= 70) return "text-emerald-400"
  if (prob >= 55) return "text-green-400"
  if (prob >= 45) return "text-yellow-400"
  if (prob >= 30) return "text-orange-400"
  return "text-red-400"
}

export function getProbabilityBgClass(prob: number): string {
  if (prob >= 70) return "bg-emerald-500"
  if (prob >= 55) return "bg-green-500"
  if (prob >= 45) return "bg-yellow-500"
  if (prob >= 30) return "bg-orange-500"
  return "bg-red-500"
}
