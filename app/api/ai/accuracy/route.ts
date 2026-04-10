import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { readMarketSnapshots } from '@/lib/odds/market-store';
import { americanOddsToImpliedProb } from '@/lib/odds/market-utils';

function metricAccuracy(players: any[], metric: 'points' | 'assists' | 'rebounds') {
  if (!players.length) return 0;
  const field = metric === 'points' ? 'projectedPoints' : metric === 'assists' ? 'projectedAssists' : 'projectedRebounds';
  const seasonField = metric;

  const errors = players.map((p) => {
    const predicted = Number(p.projection?.[field] || 0);
    const actual = Number(p.seasonStats?.[seasonField] || 0);
    const denom = Math.max(1, actual);
    return Math.abs(predicted - actual) / denom;
  });

  const mape = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  return Math.max(0, Math.min(100, Number((100 - mape * 100).toFixed(2))));
}

function dateOffsetISO(base: Date, offsetDays: number, timeZone = process.env.APP_TIMEZONE || 'America/Bahia'): string {
  const utc = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(utc);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : utc.toISOString().split('T')[0];
}

function payoutForAmericanOdds(americanOdds: number, won: boolean): number {
  if (!won) return -1;
  if (!Number.isFinite(americanOdds) || americanOdds === 0) return 0;
  if (americanOdds > 0) return americanOdds / 100;
  return 100 / Math.abs(americanOdds);
}

function safePercent(value: number, total: number): number {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowDays = Math.max(1, Number(searchParams.get('windowDays') || 7));
  const boundedWindow = Math.min(30, windowDays);

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const playersResult = await orchestrator.getPlayers(season);
  const players = playersResult.data.filter((p: any) => p.projection && p.seasonStats);

  const points = metricAccuracy(players, 'points');
  const assists = metricAccuracy(players, 'assists');
  const rebounds = metricAccuracy(players, 'rebounds');
  const overall = Number(((points + assists + rebounds) / 3).toFixed(2));

  const snapshots = await readMarketSnapshots();
  const now = new Date();
  const dateList = Array.from({ length: boundedWindow }).map((_, idx) => dateOffsetISO(now, -idx));
  const gamesResults = await Promise.all(dateList.map((d) => orchestrator.getGamesToday(d)));
  const finishedGames = gamesResults
    .flatMap((r) => r.data || [])
    .filter((g: any) => g.status === 'final' || g.GameStatus === 3);
  const finishedByGameId = new Map(
    finishedGames.map((g: any) => [
      String(g.gameId || g.id),
      {
        homeScore: Number(g.homeScore || 0),
        awayScore: Number(g.awayScore || 0),
        total: Number(g.homeScore || 0) + Number(g.awayScore || 0),
        spreadHome: Number(g.homeScore || 0) - Number(g.awayScore || 0),
      },
    ])
  );

  const latestByMarket = new Map<string, any>();
  for (const snap of snapshots) {
    const ts = new Date(snap.timestamp).getTime();
    const existing = latestByMarket.get(snap.marketId);
    const existingTs = existing ? new Date(existing.timestamp).getTime() : 0;
    if (!existing || ts > existingTs) latestByMarket.set(snap.marketId, snap);
  }

  let atsWins = 0;
  let atsTotal = 0;
  let totalsWins = 0;
  let totalsTotal = 0;
  let propsWins = 0;
  let propsTotal = 0;
  let roiUnits = 0;
  let clvAccumulator = 0;
  let clvSamples = 0;

  const snapshotsByMarket = new Map<string, any[]>();
  for (const snap of snapshots) {
    if (!snapshotsByMarket.has(snap.marketId)) snapshotsByMarket.set(snap.marketId, []);
    snapshotsByMarket.get(snap.marketId)!.push(snap);
  }

  for (const [marketId, latest] of latestByMarket.entries()) {
    const game = finishedByGameId.get(String(latest.gameId));
    if (!game) continue;

    const history = (snapshotsByMarket.get(marketId) || []).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (history.length >= 2) {
      const open = history[0];
      const close = history[history.length - 1];
      if (Number.isFinite(Number(open.line)) && Number.isFinite(Number(close.line))) {
        clvAccumulator += Number(close.line) - Number(open.line);
        clvSamples += 1;
      }
    }

    const americanOdds = Number(latest.americanOdds || 0);
    const impliedProb = Number.isFinite(Number(latest.impliedProb))
      ? Number(latest.impliedProb)
      : americanOddsToImpliedProb(americanOdds);
    const modelProb = impliedProb;

    if (latest.marketType === 'spread' && Number.isFinite(Number(latest.line))) {
      atsTotal += 1;
      const line = Number(latest.line);
      const won = latest.side === 'home'
        ? game.spreadHome + line > 0
        : -game.spreadHome + line > 0;
      if (won) atsWins += 1;
      roiUnits += payoutForAmericanOdds(americanOdds, won);
      continue;
    }

    if (latest.marketType === 'total' && Number.isFinite(Number(latest.line))) {
      totalsTotal += 1;
      const line = Number(latest.line);
      const won = latest.side === 'over' ? game.total > line : game.total < line;
      if (won) totalsWins += 1;
      roiUnits += payoutForAmericanOdds(americanOdds, won);
      continue;
    }

    if (
      (latest.marketType === 'player_points' || latest.marketType === 'player_assists' || latest.marketType === 'player_rebounds')
      && latest.playerId
      && Number.isFinite(Number(latest.line))
    ) {
      propsTotal += 1;
      const box = await orchestrator.getGameBoxscore(String(latest.gameId));
      const playersList = [
        ...(box.data?.homeTeam?.players || []),
        ...(box.data?.awayTeam?.players || []),
      ];
      const playerBox = playersList.find((p: any) => String(p.playerId) === String(latest.playerId));
      const statValue = latest.marketType === 'player_points'
        ? Number(playerBox?.points || 0)
        : latest.marketType === 'player_assists'
          ? Number(playerBox?.assists || 0)
          : Number(playerBox?.rebounds || 0);
      const won = latest.side === 'over' ? statValue > Number(latest.line) : statValue < Number(latest.line);
      if (won) propsWins += 1;
      roiUnits += payoutForAmericanOdds(americanOdds, won);
      void modelProb;
    }
  }

  const sampleSize = atsTotal + totalsTotal + propsTotal;
  const roi = sampleSize ? Number(((roiUnits / sampleSize) * 100).toFixed(2)) : 0;
  const clv = clvSamples ? Number((clvAccumulator / clvSamples).toFixed(3)) : 0;

  return NextResponse.json({
    success: true,
    data: {
      overall: {
        correct: Math.round((overall / 100) * players.length),
        total: players.length,
        accuracy: overall,
        lastUpdated: new Date().toISOString(),
      },
      byMetric: {
        points,
        assists,
        rebounds,
      },
      betting: {
        atsAccuracy: safePercent(atsWins, atsTotal),
        totalsAccuracy: safePercent(totalsWins, totalsTotal),
        propsAccuracy: safePercent(propsWins, propsTotal),
        roi,
        clv,
        sampleSize,
      },
      period: {
        windowDays: boundedWindow,
        method: 'season-projection-vs-season-average + market-snapshots',
      },
    },
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: sampleSize > 0
      ? playersResult.warning
      : (playersResult.warning || 'No settled market snapshots found to compute ATS/Totals/Props accuracy'),
    errorCode: playersResult.errorCode,
  });
}
