import { NextResponse } from 'next/server';
import { collectBoltOddsMarketSnapshots } from '@/lib/odds/boltodds-collector';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await collectBoltOddsMarketSnapshots({
      apiKey: process.env.BOLTODDS_API_KEY,
      sports: Array.isArray(body?.sports) ? body.sports : undefined,
      sportsbooks: Array.isArray(body?.sportsbooks) ? body.sportsbooks : undefined,
      games: Array.isArray(body?.games) ? body.games : undefined,
      markets: Array.isArray(body?.markets) ? body.markets : undefined,
      durationSec: Number(body?.durationSec || 25),
      maxMessages: Number(body?.maxMessages || 800),
    });

    return NextResponse.json({
      success: true,
      data: result,
      source: result.inserted > 0 ? 'boltodds' : 'none',
      sourceHealth: result.inserted > 0 ? 'ok' : 'degraded',
      cacheStatus: result.inserted > 0 ? 'fresh' : 'rejected',
      warning: result.warning,
      errorCode: result.errorCode,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      data: {
        success: false,
        inserted: 0,
        totalSnapshots: 0,
        receivedMessages: 0,
        parsedMarkets: 0,
      },
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: `Odds collection failed: ${error?.message || 'unknown error'}`,
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Use POST to start a BoltOdds collection window',
    example: {
      method: 'POST',
      body: {
        durationSec: 25,
        maxMessages: 800,
        sports: ['NBA'],
      },
    },
  });
}

