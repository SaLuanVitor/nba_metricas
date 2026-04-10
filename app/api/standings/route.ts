import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

export async function GET() {
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getTeams(season);

  const standings = result.data
    .slice()
    .sort((a: any, b: any) => {
      const winPctA = a.stats.wins / Math.max(1, a.stats.wins + a.stats.losses);
      const winPctB = b.stats.wins / Math.max(1, b.stats.wins + b.stats.losses);
      return winPctB - winPctA;
    })
    .map((team: any, index: number) => ({
      teamId: team.id,
      teamName: team.name,
      teamAbbreviation: team.abbreviation,
      conference: team.conference,
      division: team.division,
      wins: team.stats.wins,
      losses: team.stats.losses,
      winPct: Number((team.stats.wins / Math.max(1, team.stats.wins + team.stats.losses)).toFixed(3)),
      pointsPerGame: team.stats.pointsPerGame,
      pointsAgainstPerGame: 0,
      rank: index + 1,
      streak: team.streak,
      last10: team.lastGames.slice(-5).join('-'),
    }));

  return NextResponse.json({
    success: true,
    data: standings,
    season: season || 'current',
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
  });
}

