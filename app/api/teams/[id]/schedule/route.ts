import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';

type Params = { params: Promise<{ id: string }> };

function getTodayISO(): string {
  return getLocalISODate();
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayISO();
  const orchestrator = getDataOrchestrator();
  const gamesResult = await orchestrator.getGamesToday(date);
  const schedule = gamesResult.data.filter(
    (g: any) => g.homeTeam?.id?.toString() === id || g.awayTeam?.id?.toString() === id
  );

  return NextResponse.json({
    success: true,
    data: schedule,
    source: gamesResult.source,
    sourceHealth: gamesResult.sourceHealth ?? 'degraded',
    cacheStatus: gamesResult.cacheStatus ?? 'rejected',
    warning: gamesResult.warning,
    errorCode: gamesResult.errorCode,
    date,
    total: schedule.length,
  });
}
