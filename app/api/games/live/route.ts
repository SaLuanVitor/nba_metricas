import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';

function getTodayISO(): string {
  return getLocalISODate();
}

export async function GET() {
  const today = getTodayISO();
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getGamesToday(today);
  const live = result.data.filter((g: any) => g.status === 'live' || g.GameStatus === 2);

  return NextResponse.json({
    success: true,
    data: live,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
    date: today,
    totalGames: live.length,
  });
}
