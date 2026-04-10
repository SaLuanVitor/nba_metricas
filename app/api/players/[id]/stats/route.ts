import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getPlayerStats(id, season);
  const payload = result.data;

  if (!payload) {
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

  return NextResponse.json({
    success: true,
    data: payload,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
  });
}
