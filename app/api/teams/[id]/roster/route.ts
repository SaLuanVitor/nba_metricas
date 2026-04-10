import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getTeamRoster(id, season);
  const roster = playersResult.data;

  return NextResponse.json({
    success: true,
    data: roster,
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: playersResult.warning,
    errorCode: playersResult.errorCode,
    total: roster.length,
  });
}
