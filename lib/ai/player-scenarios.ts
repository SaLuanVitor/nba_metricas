import type { Player, TeamWithStats } from '@/lib/types';

export type ScenarioRange = {
  label: string;
  min: number;
  max: number;
  probability: number;
};

export type MetricScenario = {
  floor: number;
  base: number;
  ceiling: number;
  ranges: ScenarioRange[];
  confidence: number;
  trend: 'up' | 'stable' | 'down';
};

export type StatusPrediction = {
  availability: 'active' | 'probable' | 'questionable' | 'out';
  performance: 'hot' | 'stable' | 'cold';
  confidence: number;
};

export type PlayerDebateRound = {
  id: string;
  title: string;
  teamAgentClaim: string;
  opponentAgentCounter: string;
  verification: string;
  winner: 'team_agent' | 'opponent_agent' | 'draw';
};

export type PlayerDebateResult = {
  rounds: PlayerDebateRound[];
  finalVerdict: 'CONFIAVEL' | 'NAO_CONFIAVEL';
  trustScore: number;
  reasons: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function to1(value: number): number {
  return Number(value.toFixed(1));
}

function pickTrend(seasonValue: number, recentValue: number): 'up' | 'stable' | 'down' {
  if (seasonValue <= 0 && recentValue <= 0) return 'stable';
  const deltaPct = seasonValue > 0 ? ((recentValue - seasonValue) / seasonValue) * 100 : 0;
  if (deltaPct > 8) return 'up';
  if (deltaPct < -8) return 'down';
  return 'stable';
}

function buildRanges(floor: number, base: number, ceiling: number): ScenarioRange[] {
  const p1 = clamp(Math.round(25 + (base - floor) * 2), 18, 45);
  const p3 = clamp(Math.round(22 + (ceiling - base) * 2), 15, 40);
  const p2 = clamp(100 - p1 - p3, 20, 60);
  const adjP3 = 100 - p1 - p2;
  return [
    { label: 'Baixa', min: floor, max: to1((floor + base) / 2), probability: p1 },
    { label: 'Base', min: to1((floor + base) / 2), max: to1((base + ceiling) / 2), probability: p2 },
    { label: 'Alta', min: to1((base + ceiling) / 2), max: ceiling, probability: adjP3 },
  ];
}

function scenarioForMetric(
  seasonValue: number,
  recentValue: number,
  confidenceSeed: number,
  lowVariance = false
): MetricScenario {
  const base = to1(seasonValue > 0 ? (seasonValue * 0.65 + recentValue * 0.35) : recentValue);
  const variancePct = lowVariance ? 0.14 : 0.24;
  const floor = to1(Math.max(0, base * (1 - variancePct)));
  const ceiling = to1(Math.max(base, base * (1 + variancePct)));
  return {
    floor,
    base,
    ceiling,
    ranges: buildRanges(floor, base, ceiling),
    confidence: clamp(Math.round(confidenceSeed), 35, 95),
    trend: pickTrend(seasonValue, recentValue),
  };
}

function getAvailability(player: Player): StatusPrediction['availability'] {
  const raw = String(player.injury?.status || '').toLowerCase();
  if (raw.includes('out')) return 'out';
  if (raw.includes('question')) return 'questionable';
  if (raw.includes('prob')) return 'probable';
  return 'active';
}

export function buildPlayerStatusPrediction(player: Player, coverageRatio: number): StatusPrediction {
  const minSafe = Number(process.env.STATUS_CONFIDENCE_MIN_SAFE || 70);
  const targetSafe = Number(process.env.STATUS_CONFIDENCE_TARGET || 80);
  const availability = getAvailability(player);
  const seasonPts = Number(player.seasonStats?.points || 0);
  const recentPts = (player.last5Games || []).slice(-3).reduce((sum, g) => sum + Number(g.points || 0), 0) / Math.max(1, Math.min(3, (player.last5Games || []).length));
  const performance: StatusPrediction['performance'] =
    recentPts >= seasonPts * 1.08 ? 'hot' : recentPts <= seasonPts * 0.92 ? 'cold' : 'stable';

  const projectionConfidence = Number(player.projection?.confidence || 60);
  let confidence = targetSafe + (projectionConfidence - 70) * 0.25;

  if (performance === 'hot') confidence += 3;
  if (performance === 'cold') confidence -= 4;
  if (coverageRatio >= 0.8) confidence += 2;
  if (coverageRatio < 0.6) confidence -= 8;

  if (availability === 'out') confidence = Math.min(confidence, 35);
  if (availability === 'questionable') confidence = Math.min(confidence - 12, minSafe - 1);
  if (availability === 'active' || availability === 'probable') confidence = Math.max(confidence, minSafe);

  return {
    availability,
    performance,
    confidence: clamp(Math.round(confidence), 20, 95),
  };
}

export function buildPlayerMetricScenarios(
  player: Player,
  last5Stats: Array<Record<string, any>>,
  coverageRatio: number
): Record<'points' | 'assists' | 'rebounds' | 'minutes' | 'fouls' | 'steals' | 'blocks' | 'turnovers', MetricScenario> {
  const recentAvg = (key: string, fallback: number) => {
    if (!last5Stats.length) return fallback;
    return last5Stats.reduce((sum, row) => sum + Number(row[key] || 0), 0) / last5Stats.length;
  };

  const seed = clamp(Number(player.projection?.confidence || 60) * (0.7 + coverageRatio * 0.3), 30, 95);
  return {
    points: scenarioForMetric(Number(player.seasonStats?.points || 0), recentAvg('points', Number(player.seasonStats?.points || 0)), seed),
    assists: scenarioForMetric(Number(player.seasonStats?.assists || 0), recentAvg('assists', Number(player.seasonStats?.assists || 0)), seed - 3),
    rebounds: scenarioForMetric(Number(player.seasonStats?.rebounds || 0), recentAvg('rebounds', Number(player.seasonStats?.rebounds || 0)), seed - 2),
    minutes: scenarioForMetric(Number(player.seasonStats?.minutes || 0), recentAvg('minutes', Number(player.seasonStats?.minutes || 0)), seed - 4, true),
    fouls: scenarioForMetric(Number(player.seasonStats?.fouls || 2.2), recentAvg('fouls', Number(player.seasonStats?.fouls || 2.2)), seed - 10, true),
    steals: scenarioForMetric(Number(player.seasonStats?.steals || 0), recentAvg('steals', Number(player.seasonStats?.steals || 0)), seed - 7, true),
    blocks: scenarioForMetric(Number(player.seasonStats?.blocks || 0), recentAvg('blocks', Number(player.seasonStats?.blocks || 0)), seed - 8, true),
    turnovers: scenarioForMetric(Number(player.seasonStats?.turnovers || 0), recentAvg('turnovers', Number(player.seasonStats?.turnovers || 0)), seed - 7, true),
  };
}

export function buildPlayerAgentDebate(params: {
  player: Player;
  playerTeam: TeamWithStats;
  opponentTeam: TeamWithStats;
  statusPrediction: StatusPrediction;
  metricScenarios: Record<string, MetricScenario>;
  sourceHealth: 'ok' | 'degraded';
  coverageRatio: number;
}): PlayerDebateResult {
  const { player, playerTeam, opponentTeam, statusPrediction, metricScenarios, sourceHealth, coverageRatio } = params;
  const rounds: PlayerDebateRound[] = [];

  rounds.push({
    id: 'form',
    title: 'Forma recente',
    teamAgentClaim: `${player.name} sustenta produção: base ${metricScenarios.points.base.toFixed(1)} pts.`,
    opponentAgentCounter: `Defesa adversária reduz ritmo com DEF RTG ${Number(opponentTeam.stats?.defensiveRating || 0).toFixed(1)}.`,
    verification: `Pace ${Number(playerTeam.stats?.pace || 0).toFixed(1)} vs ${Number(opponentTeam.stats?.pace || 0).toFixed(1)}.`,
    winner: metricScenarios.points.trend === 'up' ? 'team_agent' : metricScenarios.points.trend === 'down' ? 'opponent_agent' : 'draw',
  });

  rounds.push({
    id: 'minutes',
    title: 'Minutos e uso',
    teamAgentClaim: `Projeção de minutos em ${metricScenarios.minutes.base.toFixed(1)} com confiança ${metricScenarios.minutes.confidence}%.`,
    opponentAgentCounter: `Risco de faltas (${metricScenarios.fouls.base.toFixed(1)}) pode cortar tempo de quadra.`,
    verification: `Disponibilidade prevista: ${statusPrediction.availability}.`,
    winner: statusPrediction.availability === 'active' || statusPrediction.availability === 'probable' ? 'team_agent' : 'opponent_agent',
  });

  rounds.push({
    id: 'efficiency',
    title: 'Eficiência e perdas',
    teamAgentClaim: `Contribuição combinada AST+REB ${to1(metricScenarios.assists.base + metricScenarios.rebounds.base)}.`,
    opponentAgentCounter: `Turnovers projetados em ${metricScenarios.turnovers.base.toFixed(1)} elevam volatilidade.`,
    verification: `Cobertura de dados ${Math.round(coverageRatio * 100)}% e fonte ${sourceHealth}.`,
    winner: metricScenarios.turnovers.base <= 2.8 ? 'team_agent' : 'opponent_agent',
  });

  const teamWins = rounds.filter((r) => r.winner === 'team_agent').length;
  const oppWins = rounds.filter((r) => r.winner === 'opponent_agent').length;
  let trustScore = Math.round(
    Number(player.projection?.confidence || 60) * 0.45 +
    Number(statusPrediction.confidence || 60) * 0.25 +
    coverageRatio * 100 * 0.2 +
    (teamWins >= oppWins ? 10 : -8)
  );
  if (sourceHealth === 'degraded') trustScore -= 8;
  if (statusPrediction.availability === 'questionable') trustScore -= 12;
  if (statusPrediction.availability === 'out') trustScore = Math.min(trustScore, 30);
  trustScore = clamp(trustScore, 10, 95);
  const finalVerdict = trustScore >= 70 && coverageRatio >= 0.55 ? 'CONFIAVEL' : 'NAO_CONFIAVEL';
  const reasons = [
    `Cobertura estatística: ${Math.round(coverageRatio * 100)}%`,
    `Status previsto: ${statusPrediction.availability}/${statusPrediction.performance}`,
    `Confianca média das métricas: ${Math.round(Object.values(metricScenarios).reduce((s, m) => s + m.confidence, 0) / Object.values(metricScenarios).length)}%`,
  ];

  return { rounds, finalVerdict, trustScore, reasons };
}
