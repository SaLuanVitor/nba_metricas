import type { Player, TeamWithStats } from '@/lib/types';
import { analyzePlayer, analyzeTeam, analyzeTrend } from '@/lib/ai-experts';

export function buildPlayerSpecialistPrediction(player: Player) {
  const analysis = analyzePlayer(player);
  const pointsTrend = analyzeTrend(player, 'points');

  return {
    specialist: {
      type: 'player',
      entityId: player.id,
      name: `${player.name} Specialist`,
      version: 'v1',
    },
    prediction: {
      projectedPoints: player.projection.projectedPoints,
      projectedAssists: player.projection.projectedAssists,
      projectedRebounds: player.projection.projectedRebounds,
      projectedMinutes: player.projection.projectedMinutes,
      confidence: player.projection.confidence,
      trend: player.projection.trend,
    },
    explainability: {
      summary: analysis.summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      opportunities: analysis.opportunities,
      threats: analysis.threats,
      recommendation: analysis.recommendation,
      factors: [
        `Season PTS: ${player.seasonStats.points.toFixed(1)}`,
        `Season AST: ${player.seasonStats.assists.toFixed(1)}`,
        `Season REB: ${player.seasonStats.rebounds.toFixed(1)}`,
        `Trend magnitude: ${pointsTrend.magnitude}%`,
      ],
    },
  };
}

export function buildTeamSpecialistPrediction(team: TeamWithStats, roster: Player[]) {
  const analysis = analyzeTeam(team, roster);
  const avgConfidence = roster.length
    ? Number((roster.reduce((sum, p) => sum + (p.projection?.confidence || 0), 0) / roster.length).toFixed(2))
    : 0;

  return {
    specialist: {
      type: 'team',
      entityId: team.id,
      name: `${team.city} ${team.name} Specialist`,
      version: 'v1',
    },
    prediction: {
      expectedPoints: team.stats.pointsPerGame,
      expectedAssists: team.stats.assistsPerGame,
      expectedRebounds: team.stats.reboundsPerGame,
      offensiveRating: team.stats.offensiveRating,
      defensiveRating: team.stats.defensiveRating,
      confidence: Math.min(95, Math.max(50, Math.round((avgConfidence + 70) / 2))),
      trend: team.lastGames.filter((x) => x === 'W').length >= 3 ? 'up' : 'stable',
    },
    explainability: {
      summary: analysis.summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      opportunities: analysis.opportunities,
      threats: analysis.threats,
      recommendation: analysis.recommendation,
      factors: [
        `Record: ${team.stats.wins}-${team.stats.losses}`,
        `Pace: ${team.stats.pace.toFixed(1)}`,
        `Roster size: ${roster.length}`,
        `Avg roster confidence: ${avgConfidence}`,
      ],
    },
  };
}

