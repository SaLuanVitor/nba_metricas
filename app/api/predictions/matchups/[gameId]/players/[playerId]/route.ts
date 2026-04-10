import { NextResponse } from 'next/server';
import { getMatchupPlayerPrediction } from '@/lib/ai/predictions-service';

type Params = { params: Promise<{ gameId: string; playerId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { gameId, playerId } = await params;
  const { searchParams } = new URL(request.url);
  const refresh = String(searchParams.get('refresh') || 'false').toLowerCase() === 'true';
  const result = await getMatchupPlayerPrediction(gameId, playerId, { refresh });

  return NextResponse.json({
    success: true,
    data: result.data,
    source: result.source,
    sourceHealth: result.sourceHealth,
    cacheStatus: result.cacheStatus,
    warning: result.warning,
    errorCode: result.errorCode,
  });
}
