import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { calculateDoubleDouble, calculateOverUnder, calculateTripleDouble } from '@/lib/ai/engine';
import { getLatestPlayerMarketByType } from '@/lib/odds/market-store';
import { americanOddsToImpliedProb, calculateEdge, expectedValuePerUnit, toPercent } from '@/lib/odds/market-utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId') || undefined;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const [result, statsResult] = await Promise.all([
    orchestrator.getPlayerById(id, season),
    orchestrator.getPlayerStats(id, season),
  ]);
  const player = result.data ? { ...result.data } : null;

  if (!player) {
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

  const last5 = Array.isArray(statsResult.data?.last5) ? statsResult.data!.last5 : [];
  player.last5Games = last5.map((g: any) => ({
    points: Number(g.points || 0),
    assists: Number(g.assists || 0),
    rebounds: Number(g.rebounds || 0),
    minutes: Number(g.minutes || 0),
    fieldGoalPercentage: Number(g.fieldGoalPercentage || 0),
    threePointPercentage: Number(g.threePointPercentage || 0),
    freeThrowPercentage: Number(g.freeThrowPercentage || 0),
    steals: Number(g.steals || 0),
    blocks: Number(g.blocks || 0),
    turnovers: Number(g.turnovers || 0),
  }));

  const [pointsMarket, assistsMarket, reboundsMarket] = await Promise.all([
    getLatestPlayerMarketByType(String(player.id), 'player_points', gameId),
    getLatestPlayerMarketByType(String(player.id), 'player_assists', gameId),
    getLatestPlayerMarketByType(String(player.id), 'player_rebounds', gameId),
  ]);

  const pointsLine = Number.isFinite(Number(pointsMarket?.line))
    ? Number(pointsMarket!.line)
    : Number((player.projection.projectedPoints || 0).toFixed(1));
  const assistsLine = Number.isFinite(Number(assistsMarket?.line))
    ? Number(assistsMarket!.line)
    : Number((player.projection.projectedAssists || 0).toFixed(1));
  const reboundsLine = Number.isFinite(Number(reboundsMarket?.line))
    ? Number(reboundsMarket!.line)
    : Number((player.projection.projectedRebounds || 0).toFixed(1));

  const points = calculateOverUnder(player, 'points', pointsLine);
  const assists = calculateOverUnder(player, 'assists', assistsLine);
  const rebounds = calculateOverUnder(player, 'rebounds', reboundsLine);

  function enrichMarket(
    overProb: number,
    market: typeof pointsMarket
  ) {
    if (!market || !Number.isFinite(Number(market.line))) {
      return {
        marketLine: null,
        impliedProb: null,
        modelProb: Number(overProb),
        edge: null,
        expectedValue: null,
        lineTimestamp: null,
      };
    }
    const americanOdds = Number(market.americanOdds);
    const implied = Number.isFinite(Number(market.impliedProb))
      ? Number(market.impliedProb)
      : americanOddsToImpliedProb(americanOdds);
    const modelProbDecimal = Number(overProb) / 100;
    const edge = calculateEdge(modelProbDecimal, implied);
    const ev = Number.isFinite(americanOdds) ? expectedValuePerUnit(modelProbDecimal, americanOdds) : 0;
    return {
      marketLine: Number(market.line),
      impliedProb: toPercent(implied),
      modelProb: Number(overProb),
      edge: toPercent(edge),
      expectedValue: Number((ev * 100).toFixed(2)),
      lineTimestamp: market.timestamp || null,
    };
  }

  const hasLast5 = player.last5Games.length >= 3;
  const hasInjuryContext = Boolean(player.injury);
  const hasMarketLine = Boolean(pointsMarket || assistsMarket || reboundsMarket);
  const contextCoverage = {
    hasLast5,
    hasInjuryContext,
    hasMarketLine,
    coverage: Number(((Number(hasLast5) + Number(hasInjuryContext) + Number(hasMarketLine)) / 3).toFixed(2)),
  };

  const warningParts: string[] = [];
  if (!hasLast5) warningParts.push('Low context: missing recent last5 games');
  if (!hasInjuryContext) warningParts.push('Low context: injury status unavailable');
  if (!hasMarketLine) warningParts.push('No real market line snapshot available for this player');
  if (result.warning) warningParts.push(result.warning);
  if (statsResult.warning) warningParts.push(statsResult.warning);

  return NextResponse.json({
    success: true,
    data: {
      playerId: player.id,
      overUnder: {
        points: { line: pointsLine, ...points, ...enrichMarket(points.over, pointsMarket), lineType: pointsMarket ? 'market' : 'model' },
        assists: { line: assistsLine, ...assists, ...enrichMarket(assists.over, assistsMarket), lineType: assistsMarket ? 'market' : 'model' },
        rebounds: { line: reboundsLine, ...rebounds, ...enrichMarket(rebounds.over, reboundsMarket), lineType: reboundsMarket ? 'market' : 'model' },
      },
      doubleDouble: calculateDoubleDouble(player),
      tripleDouble: calculateTripleDouble(player),
      contextCoverage,
    },
    source: result.source,
    sourceHealth: contextCoverage.coverage >= 0.67 ? (result.sourceHealth ?? 'ok') : 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: warningParts.length ? warningParts.join(' | ') : undefined,
    errorCode: result.errorCode,
  });
}
