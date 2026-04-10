import { NextResponse } from 'next/server';
import { getMatchupPrediction } from '@/lib/ai/predictions-service';

type Params = { params: Promise<{ gameId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const refresh = String(searchParams.get('refresh') || 'false').toLowerCase() === 'true';
  const forcePersist = String(searchParams.get('forcePersist') || 'false').toLowerCase() === 'true';
  const result = await getMatchupPrediction(gameId, {
    persistLearners: true,
    refresh,
    forcePersistLearning: forcePersist,
  });

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
