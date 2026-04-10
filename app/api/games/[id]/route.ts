import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';

type Params = { params: Promise<{ id: string }> };

function getTodayISO(): string {
  return getLocalISODate();
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getGamesToday(getTodayISO());
  const game = result.data.find((g: any) => g.id === id || g.gameId === id) || null;

  return NextResponse.json({
    success: true,
    data: game,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: game ? result.warning : (result.warning || 'Game not found'),
    errorCode: result.errorCode,
  });
}
