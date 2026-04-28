import type { 
  Player, 
  TeamWithStats,
  ExpertAnalysis,
  AIInsight,
  TrendAnalysis,
  TrendDirection,
  StatCategory
} from "./types"
import { generatePlayerProbabilities, getConfidenceLevel } from "./probability-engine"

// Determina direcao da tendencia
function getTrendDirection(change: number): TrendDirection {
  if (change > 15) return "strong-up"
  if (change > 5) return "up"
  if (change > -5) return "stable"
  if (change > -15) return "down"
  return "strong-down"
}

export function getTrendColor(direction: TrendDirection): string {
  const colors: Record<TrendDirection, string> = {
    "strong-up": "text-emerald-400",
    "up": "text-green-400",
    "stable": "text-gray-400",
    "down": "text-orange-400",
    "strong-down": "text-red-400"
  }
  return colors[direction]
}

export function getTrendIcon(direction: TrendDirection): string {
  const icons: Record<TrendDirection, string> = {
    "strong-up": "↑↑",
    "up": "↑",
    "stable": "→",
    "down": "↓",
    "strong-down": "↓↓"
  }
  return icons[direction]
}

// Analise de especialista para jogador
export function analyzePlayer(player: Player): ExpertAnalysis {
  const stats = player.seasonStats
  const projection = player.projection
  const probs = generatePlayerProbabilities(player)
  
  const strengths: string[] = []
  const weaknesses: string[] = []
  const opportunities: string[] = []
  const threats: string[] = []
  
  // Analisa pontos
  if (stats.points > 25) {
    strengths.push(`Elite scorer com ${stats.points.toFixed(1)} PPG`)
  } else if (stats.points > 18) {
    strengths.push(`Pontuador consistente com ${stats.points.toFixed(1)} PPG`)
  }
  
  // Analisa eficiencia
  if (stats.fieldGoalPercentage > 50) {
    strengths.push(`Alta eficiencia (${stats.fieldGoalPercentage.toFixed(1)}% FG)`)
  } else if (stats.fieldGoalPercentage < 42) {
    weaknesses.push(`Eficiencia abaixo da media (${stats.fieldGoalPercentage.toFixed(1)}% FG)`)
  }
  
  // Analisa 3 pontos
  if (stats.threePointPercentage > 38) {
    strengths.push(`Excelente arremessador de 3 pontos (${stats.threePointPercentage.toFixed(1)}%)`)
  } else if (stats.threePointPercentage < 33) {
    weaknesses.push(`Precisa melhorar arremesso de 3 (${stats.threePointPercentage.toFixed(1)}%)`)
  }
  
  // Analisa playmaking
  if (stats.assists > 7) {
    strengths.push(`Elite playmaker com ${stats.assists.toFixed(1)} APG`)
  } else if (stats.assists > 4) {
    strengths.push(`Bom distribuidor com ${stats.assists.toFixed(1)} APG`)
  }
  
  // Analisa rebotes
  if (stats.rebounds > 10) {
    strengths.push(`Dominante nos rebotes (${stats.rebounds.toFixed(1)} RPG)`)
  } else if (stats.rebounds > 6) {
    strengths.push(`Contribui bem nos rebotes (${stats.rebounds.toFixed(1)} RPG)`)
  }
  
  // Analisa turnovers
  if (stats.turnovers > 3.5) {
    weaknesses.push(`Alto numero de turnovers (${stats.turnovers.toFixed(1)} TPG)`)
  }
  
  // Oportunidades baseadas em tendencia
  if (projection.trend === "up") {
    opportunities.push("Momento positivo - tendencia de alta nas ultimas partidas")
  }
  if (probs.doubleDouble.value > 50) {
    opportunities.push(`${probs.doubleDouble.value}% de chance de double-double`)
  }
  if (player.fantasyPoints > 45) {
    opportunities.push("Alto valor de fantasy - potencial de pontuacao explosiva")
  }
  
  // Ameacas
  if (player.injury) {
    threats.push(`Lesao: ${player.injury.status} - ${player.injury.description}`)
  }
  if (projection.trend === "down") {
    threats.push("Tendencia de queda nas ultimas partidas")
  }
  if (projection.confidence < 60) {
    threats.push("Baixa confianca nas projecoes - volatilidade esperada")
  }
  
  // Gera recomendacao
  let recommendation: string
  const overallScore = (stats.points * 1.5 + stats.assists * 1.2 + stats.rebounds) / 3 + projection.confidence * 0.3
  
  if (overallScore > 45 && !player.injury) {
    recommendation = "FORTE RECOMENDACAO - Jogador de alto impacto com projecoes favoraveis"
  } else if (overallScore > 35) {
    recommendation = "RECOMENDADO - Bom potencial de contribuicao com riscos moderados"
  } else if (player.injury) {
    recommendation = "CAUTELA - Monitorar status de lesao antes de decisoes"
  } else {
    recommendation = "RISCO - Considerar alternativas com melhor relacao risco/retorno"
  }
  
  return {
    expertType: "player",
    entityId: player.id,
    summary: `${player.name} e um ${stats.points > 20 ? "pontuador de elite" : "contribuidor solido"} com ${strengths.length} pontos fortes identificados e ${weaknesses.length} areas de atencao.`,
    strengths,
    weaknesses,
    opportunities,
    threats,
    recommendation,
    confidenceScore: projection.confidence
  }
}

// Analise de especialista para time
export function analyzeTeam(team: TeamWithStats, roster: Player[]): ExpertAnalysis {
  const stats = team.stats
  
  const strengths: string[] = []
  const weaknesses: string[] = []
  const opportunities: string[] = []
  const threats: string[] = []
  
  // Analisa record
  const winPct = stats.wins / (stats.wins + stats.losses)
  if (winPct > 0.65) {
    strengths.push(`Excelente record (${stats.wins}-${stats.losses}, ${(winPct * 100).toFixed(1)}%)`)
  } else if (winPct > 0.55) {
    strengths.push(`Record positivo (${stats.wins}-${stats.losses})`)
  } else if (winPct < 0.45) {
    weaknesses.push(`Record abaixo de .500 (${stats.wins}-${stats.losses})`)
  }
  
  // Analisa ofensiva
  if (stats.offensiveRating > 118) {
    strengths.push(`Ofensiva de elite (${stats.offensiveRating.toFixed(1)} OFF RTG)`)
  } else if (stats.offensiveRating < 110) {
    weaknesses.push(`Ofensiva precisa melhorar (${stats.offensiveRating.toFixed(1)} OFF RTG)`)
  }
  
  // Analisa defensiva
  if (stats.defensiveRating < 110) {
    strengths.push(`Defesa solida (${stats.defensiveRating.toFixed(1)} DEF RTG)`)
  } else if (stats.defensiveRating > 115) {
    weaknesses.push(`Defesa vulneravel (${stats.defensiveRating.toFixed(1)} DEF RTG)`)
  }
  
  // Analisa arremesso
  if (stats.threePointPercentage > 37) {
    strengths.push(`Time bem preparado de 3 pontos (${stats.threePointPercentage.toFixed(1)}%)`)
  }
  
  // Analisa pace
  if (stats.pace > 102) {
    strengths.push(`Jogo rapido e transicao efetiva (${stats.pace.toFixed(1)} PACE)`)
  } else if (stats.pace < 97) {
    strengths.push(`Controle de ritmo - jogo mais lento e controlado`)
  }
  
  // Analisa elenco
  const injuredPlayers = roster.filter(p => p.injury)
  
  if (injuredPlayers.length > 0) {
    threats.push(`${injuredPlayers.length} jogador(es) com problema de lesao`)
  }
  
  const avgFantasy = roster.reduce((sum, p) => sum + p.fantasyPoints, 0) / roster.length
  if (avgFantasy > 40) {
    strengths.push(`Elenco de alto nivel (${avgFantasy.toFixed(1)} FP medio)`)
  }
  
  // Momentum
  const recentWins = team.lastGames.filter(g => g === "W").length
  if (recentWins >= 4) {
    opportunities.push(`Em otimo momento - ${recentWins} vitorias nos ultimos 5 jogos`)
  } else if (recentWins <= 1) {
    threats.push(`Momento ruim - apenas ${recentWins} vitoria(s) nos ultimos 5 jogos`)
  }
  
  // Recomendacao
  const teamScore = winPct * 30 + (stats.offensiveRating - 100) * 0.5 + (120 - stats.defensiveRating) * 0.5
  let recommendation: string
  
  if (teamScore > 35) {
    recommendation = "TIME DE ELITE - Favorito consistente em matchups"
  } else if (teamScore > 25) {
    recommendation = "TIME COMPETITIVO - Bom potencial em situacoes favoraveis"
  } else {
    recommendation = "EM CONSTRUCAO - Evitar apostar como favorito em jogos importantes"
  }
  
  return {
    expertType: "team",
    entityId: team.id,
    summary: `${team.city} ${team.name} esta com record de ${stats.wins}-${stats.losses} e apresenta ${strengths.length} pontos fortes na analise.`,
    strengths,
    weaknesses,
    opportunities,
    threats,
    recommendation,
    confidenceScore: Math.min(95, Math.round(teamScore * 2))
  }
}

// Gera insights de IA
export function generateInsights(players: Player[], teams: TeamWithStats[]): AIInsight[] {
  const insights: AIInsight[] = []
  const now = new Date()
  
  // Insights de jogadores em alta
  const hotPlayers = players.filter(p => p.projection.trend === "up" && p.projection.confidence > 75)
  hotPlayers.slice(0, 3).forEach(player => {
    insights.push({
      id: `hot-${player.id}`,
      type: "player",
      severity: "positive",
      title: `${player.name} em Alta`,
      description: `Projecao de ${player.projection.projectedPoints.toFixed(1)} pontos com ${player.projection.confidence}% de confianca. Tendencia positiva.`,
      confidence: getConfidenceLevel(player.projection.confidence),
      relatedEntityId: player.id,
      relatedEntityType: "player",
      timestamp: now,
      factors: ["Tendencia de alta", "Alta confianca na projecao"]
    })
  })
  
  // Insights de jogadores lesionados
  const injuredPlayers = players.filter(p => p.injury)
  injuredPlayers.forEach(player => {
    insights.push({
      id: `injury-${player.id}`,
      type: "alert",
      severity: "warning",
      title: `Alerta de Lesao: ${player.name}`,
      description: `Status: ${player.injury!.status} - ${player.injury!.description}. Considerar alternativas.`,
      confidence: "high",
      relatedEntityId: player.id,
      relatedEntityType: "player",
      timestamp: now,
      factors: [player.injury!.status, player.injury!.description]
    })
  })
  
  // Insights de times quentes
  teams.filter(t => t.lastGames.filter(g => g === "W").length >= 4).forEach(team => {
    insights.push({
      id: `streak-${team.id}`,
      type: "team",
      severity: "positive",
      title: `${team.city} ${team.name} em Sequencia`,
      description: `Time venceu ${team.lastGames.filter(g => g === "W").length} dos ultimos 5 jogos. Sequencia atual: ${team.streak}`,
      confidence: "high",
      relatedEntityId: team.id,
      relatedEntityType: "team",
      timestamp: now,
      factors: ["Sequencia de vitorias", team.streak]
    })
  })
  
  // Insights de matchups interessantes
  const topTeams = teams.slice(0, 4)
  if (topTeams.length >= 2) {
    insights.push({
      id: "matchup-analysis",
      type: "matchup",
      severity: "info",
      title: "Confrontos de Destaque",
      description: `${topTeams[0].city} ${topTeams[0].name} vs ${topTeams[1].city} ${topTeams[1].name} seria um confronto de alto nivel com ambos os times em boa fase.`,
      confidence: "medium",
      timestamp: now,
      factors: ["Times de elite", "Potencial confronto de playoffs"]
    })
  }
  
  return insights.sort((a, b) => {
    const severityOrder = { positive: 0, warning: 1, negative: 2, info: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

// Analise simplificada para dados reais da API (quando alguns campos nao estao disponiveis)
export function analyzePlayerRaw(player: any): ExpertAnalysis {
  const stats = player.seasonStats || {}
  const projection = player.projection || {}
  
  const strengths: string[] = []
  const points = stats.points || 0
  const assists = stats.assists || 0
  const rebounds = stats.rebounds || 0
  
  if (points > 25) {
    strengths.push(`Elite scorer com ${points.toFixed(1)} PPG`)
  } else if (points > 18) {
    strengths.push(`Pontuador consistente com ${points.toFixed(1)} PPG`)
  }
  
  if (assists > 7) {
    strengths.push(`Bom playmaker com ${assists.toFixed(1)} APG`)
  }
  
  if (rebounds > 8) {
    strengths.push(`Contribui bem nos rebotes (${rebounds.toFixed(1)} RPG)`)
  }
  
  const confidence = projection.confidence || 60
  
  return {
    expertType: "player",
    entityId: player.id,
    summary: `${player.name || 'Jogador'} - dados carregados da API`,
    strengths,
    weaknesses: [],
    opportunities: [],
    threats: [],
    recommendation: confidence > 70 ? "Recomendado - boa projecao" : "Atencao - dados limitados",
    confidenceScore: confidence
  }
}

// Analise de tendencia simplificada
export function analyzeTrendRaw(player: any, metric: string): TrendAnalysis {
  return {
    entityId: player.id,
    entityType: "player",
    metric: metric as StatCategory,
    direction: "stable",
    magnitude: 0,
    period: "Dados da API",
    dataPoints: [],
    prediction: []
  }
}

// Gera insights simplificados
export function generateInsightsRaw(players: any[], _teams: any[]): AIInsight[] {
  const insights: AIInsight[] = []
  const now = new Date()
  
  if (players.length > 0) {
    insights.push({
      id: 'api-status',
      type: 'alert',
      severity: 'info',
      title: 'Dados da API Carregados',
      description: `${players.length} jogadores carregados`,
      confidence: 'high',
      timestamp: now,
      factors: ['API NBA', 'Dados reais']
    })
  }
  
  return insights
}

// Analise de tendencia para um jogador
export function analyzeTrend(player: Player, metric: StatCategory): TrendAnalysis {
  const last5 = Array.isArray(player.last5Games) ? player.last5Games : []
  const metricKey = metric === "minutes" ? "minutes" : metric

  const fallbackValue = Number(player.seasonStats?.[metricKey] || 0)

  if (last5.length < 2) {
    return {
      entityId: player.id,
      entityType: "player",
      metric,
      direction: "stable",
      magnitude: 0,
      period: "Dados insuficientes",
      dataPoints: [
        { date: "Atual", value: fallbackValue },
      ],
      prediction: [
        { date: "Proximo 1", value: fallbackValue },
        { date: "Proximo 2", value: fallbackValue },
        { date: "Proximo 3", value: fallbackValue },
      ]
    }
  }
  
  // Gera pontos de dados dos ultimos 5 jogos
  const dataPoints = last5.map((game, idx) => ({
    date: `Jogo ${5 - idx}`,
    value: game[metricKey]
  })).reverse()

  const safe = dataPoints.length >= 5
    ? dataPoints
    : [
        ...Array.from({ length: 5 - dataPoints.length }).map((_, i) => ({
          date: `Hist ${i + 1}`,
          value: fallbackValue,
        })),
        ...dataPoints,
      ]
  
  // Calcula tendencia
  const recentAvg = (safe[3].value + safe[4].value) / 2
  const olderAvg = (safe[0].value + safe[1].value) / 2
  const changePercent = olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100
  
  // Gera predicao para proximos 3 jogos
  const trend = changePercent / 100
  const lastValue = safe[4].value
  const prediction = [1, 2, 3].map(i => ({
    date: `Proximo ${i}`,
    value: Math.round((lastValue * (1 + trend * 0.3 * i)) * 10) / 10
  }))
  
  return {
    entityId: player.id,
    entityType: "player",
    metric,
    direction: getTrendDirection(changePercent),
    magnitude: Math.round(Math.abs(changePercent) * 10) / 10,
    period: "Ultimos 5 jogos",
    dataPoints: safe,
    prediction
  }
}
