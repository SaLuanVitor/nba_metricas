import { NextResponse } from 'next/server';
import { getMatchupPrediction } from '@/lib/ai/predictions-service';

type Params = { params: Promise<{ gameId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { gameId } = await params;
  const result = await getMatchupPrediction(gameId, { persistLearners: true });

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
