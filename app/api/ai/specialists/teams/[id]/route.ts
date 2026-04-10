import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { buildTeamSpecialistPrediction } from '@/lib/ai/specialists';
import { getRecentSpecialistLearnings, saveSpecialistLearning } from '@/lib/ai/learning-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const [teamsResult, rosterResult] = await Promise.all([
    orchestrator.getTeams(season),
    orchestrator.getTeamRoster(id, season),
  ]);
  const team = teamsResult.data.find((t) => t.id === id);

  if (!team) {
    return NextResponse.json({
      success: true,
      data: null,
      source: teamsResult.source,
      sourceHealth: teamsResult.sourceHealth ?? 'degraded',
      cacheStatus: teamsResult.cacheStatus ?? 'rejected',
      warning: teamsResult.warning || 'Team not found',
      errorCode: teamsResult.errorCode,
    });
  }

  const specialist = buildTeamSpecialistPrediction(team, rosterResult.data);
  const persist = await saveSpecialistLearning({
    entityType: 'team',
    entityId: team.id,
    source: teamsResult.source,
    confidence: specialist.prediction.confidence,
    learning: specialist,
    sourceHealth: teamsResult.sourceHealth ?? 'degraded',
    cacheStatus: teamsResult.cacheStatus ?? 'rejected',
    tags: ['prediction', 'team', team.abbreviation || 'NBA'],
  });
  const recentLearnings = await getRecentSpecialistLearnings('team', team.id, 10);

  return NextResponse.json({
    success: true,
    data: {
      ...specialist,
      recentLearnings,
      persisted: persist.persisted,
      learningStatus: persist.status,
      lastPersistedAt: persist.lastPersistedAt || recentLearnings[0]?.capturedAt || null,
    },
    source: teamsResult.source,
    sourceHealth: teamsResult.sourceHealth ?? 'degraded',
    cacheStatus: teamsResult.cacheStatus ?? 'rejected',
    warning: persist.warning || teamsResult.warning || rosterResult.warning,
    errorCode: teamsResult.errorCode || rosterResult.errorCode,
  });
}
