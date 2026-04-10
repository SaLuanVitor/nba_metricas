import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json({
      success: true,
      data: null,
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'gameId parameter required',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
      example: '/api/boxscore?gameId=0022501165',
    });
  }

  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getGameBoxscore(gameId);

  return NextResponse.json({
    success: true,
    data: result.data,
    gameId,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
  });
}

