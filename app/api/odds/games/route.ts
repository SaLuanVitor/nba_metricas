import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { readMarketSnapshots } from '@/lib/odds/market-store';
import { getBoltOddsInfo, getBoltOddsMarketsCatalog } from '@/lib/odds-api/boltodds';
import { getLocalISODate } from '@/lib/date-utils';

function getTodayISO(): string {
  return getLocalISODate();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayISO();
  const orchestrator = getDataOrchestrator();
  const gamesResult = await orchestrator.getGamesToday(date);

  const [snapshots, boltInfo, boltMarkets] = await Promise.all([
    readMarketSnapshots(),
    getBoltOddsInfo(process.env.BOLTODDS_API_KEY),
    getBoltOddsMarketsCatalog(process.env.BOLTODDS_API_KEY, { sports: ['NBA'] }),
  ]);

  const latestByGameAndType = new Map<string, any>();
  for (const snap of snapshots) {
    const key = `${snap.gameId}:${snap.marketType}:${snap.side}:${snap.playerId || ''}`;
    const existing = latestByGameAndType.get(key);
    const existingTs = existing ? new Date(existing.timestamp).getTime() : 0;
    const currentTs = new Date(snap.timestamp).getTime();
    if (!existing || currentTs > existingTs) latestByGameAndType.set(key, snap);
  }

  const data = gamesResult.data.map((game: any) => {
    const gameId = String(game.gameId || game.id || '');
    const gameSnaps = Array.from(latestByGameAndType.values()).filter((s) => s.gameId === gameId);
    const moneylineHome = gameSnaps.find((s) => s.marketType === 'moneyline' && s.side === 'home');
    const moneylineAway = gameSnaps.find((s) => s.marketType === 'moneyline' && s.side === 'away');
    const spread = gameSnaps.find((s) => s.marketType === 'spread');
    const total = gameSnaps.find((s) => s.marketType === 'total');
    const lastUpdated = gameSnaps
      .map((s) => new Date(s.timestamp).getTime())
      .sort((a, b) => b - a)[0];

    return {
      ...game,
      market: {
        hasMarketData: gameSnaps.length > 0,
        marketsTracked: gameSnaps.length,
        moneyline: moneylineHome || moneylineAway ? { home: moneylineHome || null, away: moneylineAway || null } : null,
        spread: spread || null,
        total: total || null,
        lastUpdated: Number.isFinite(lastUpdated) ? new Date(lastUpdated).toISOString() : null,
      },
    };
  });

  const sportsbookCatalog = Object.keys((boltMarkets.data as any) || {});
  const warnings: string[] = [];
  if (gamesResult.warning) warnings.push(gamesResult.warning);
  if (!snapshots.length) warnings.push('No persisted market line snapshots found for games');
  if (boltInfo.warning) warnings.push(boltInfo.warning);
  if (boltMarkets.warning) warnings.push(boltMarkets.warning);

  return NextResponse.json({
    success: true,
    data,
    source: gamesResult.source,
    sourceHealth: gamesResult.sourceHealth ?? 'degraded',
    cacheStatus: gamesResult.cacheStatus ?? 'rejected',
    warning: warnings.length ? warnings.join(' | ') : undefined,
    errorCode: gamesResult.errorCode || boltInfo.errorCode || boltMarkets.errorCode,
    date,
    totalGames: data.length,
    marketCoverage: {
      gamesWithMarketData: data.filter((g: any) => g.market?.hasMarketData).length,
      snapshots: snapshots.length,
      sportsbooks: sportsbookCatalog,
    },
  });
}
