import { NextResponse } from 'next/server';
import { getMarketMovements } from '@/lib/odds/market-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get('marketId') || undefined;
  const gameId = searchParams.get('gameId') || undefined;
  const marketType = searchParams.get('marketType') || undefined;

  const result = await getMarketMovements(marketId);
  let snapshots = result.snapshots;
  let movements = result.movements;

  if (gameId) {
    snapshots = snapshots.filter((s) => s.gameId === gameId);
    movements = movements.filter((m) => m.gameId === gameId);
  }
  if (marketType) {
    snapshots = snapshots.filter((s) => s.marketType === marketType);
    movements = movements.filter((m) => m.marketType === marketType);
  }

  return NextResponse.json({
    success: true,
    data: {
      movements,
      snapshots,
    },
    source: snapshots.length > 0 ? snapshots[0].source : 'none',
    sourceHealth: snapshots.length > 0 ? 'ok' : 'degraded',
    cacheStatus: snapshots.length > 0 ? 'fresh' : 'rejected',
    warning: snapshots.length ? undefined : 'No market movement snapshots available',
    errorCode: snapshots.length ? undefined : 'UPSTREAM_BAD_RESPONSE',
    totalMovements: movements.length,
    totalSnapshots: snapshots.length,
  });
}

