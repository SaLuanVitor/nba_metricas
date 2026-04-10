import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getPlayerById(id, season);
  const player = result.data;

  return NextResponse.json({
    success: true,
    data: player || null,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: player ? result.warning : (result.warning || 'Player not found'),
    errorCode: result.errorCode,
  });
}
