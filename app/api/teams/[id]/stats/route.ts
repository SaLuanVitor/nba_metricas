import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getTeams(season);
  const team = result.data.find((t) => t.id === id);

  return NextResponse.json({
    success: true,
    data: team?.stats || null,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: team ? result.warning : (result.warning || 'Team not found'),
    errorCode: result.errorCode,
  });
}
