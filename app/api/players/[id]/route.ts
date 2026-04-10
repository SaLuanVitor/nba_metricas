import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
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
  } catch (error: any) {
    console.error('[API_PLAYER_BY_ID_FAILED]', error);
    return NextResponse.json({
      success: true,
      data: null,
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'Falha temporaria ao consultar jogador',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }
}
