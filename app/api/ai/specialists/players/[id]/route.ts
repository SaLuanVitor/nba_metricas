import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { buildPlayerSpecialistPrediction } from '@/lib/ai/specialists';
import { getRecentSpecialistLearnings, saveSpecialistLearning } from '@/lib/ai/learning-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getPlayerById(id, season);
  const player = result.data;

  if (!player) {
    return NextResponse.json({
      success: true,
      data: null,
      source: result.source,
      sourceHealth: result.sourceHealth ?? 'degraded',
      cacheStatus: result.cacheStatus ?? 'rejected',
      warning: result.warning || 'Player not found',
      errorCode: result.errorCode,
    });
  }

  const specialist = buildPlayerSpecialistPrediction(player);
  const persist = await saveSpecialistLearning({
    entityType: 'player',
    entityId: player.id,
    source: result.source,
    confidence: specialist.prediction.confidence,
    learning: specialist,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    tags: ['prediction', 'player', player.team?.abbreviation || 'NBA'],
  });
  const recentLearnings = await getRecentSpecialistLearnings('player', player.id, 10);

  return NextResponse.json({
    success: true,
    data: {
      ...specialist,
      recentLearnings,
      persisted: persist.persisted,
      learningStatus: persist.status,
      lastPersistedAt: persist.lastPersistedAt || recentLearnings[0]?.capturedAt || null,
    },
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: persist.warning || result.warning,
    errorCode: result.errorCode,
  });
}
