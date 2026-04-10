import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const orchestrator = getDataOrchestrator();
  const boxResult = await orchestrator.getGameBoxscore(id);

  return NextResponse.json({
    success: true,
    data: boxResult.data || {
      gameId: id,
      homeTeam: { totalPoints: null, players: [] },
      awayTeam: { totalPoints: null, players: [] },
    },
    source: boxResult.source,
    sourceHealth: boxResult.sourceHealth ?? 'degraded',
    cacheStatus: boxResult.cacheStatus ?? 'rejected',
    warning: boxResult.warning,
    errorCode: boxResult.errorCode,
  });
}
