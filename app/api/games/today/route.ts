import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';

function getTodayISO(): string {
  return getLocalISODate();
}

export async function GET() {
  const today = getTodayISO();
  const timezone = process.env.APP_TIMEZONE || 'America/Bahia';
  console.log('=== GAMES API ===');
  console.log('Today (ISO):', today);

  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getGamesToday(today);

  return NextResponse.json({
    success: true,
    data: result.data,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
    date: today,
    timezone,
    totalGames: result.data.length,
  });
}
