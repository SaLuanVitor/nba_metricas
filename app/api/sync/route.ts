import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { collectBoltOddsMarketSnapshots } from '@/lib/odds/boltodds-collector';
import { pruneExpired } from '@/lib/cache/snapshot-store';

type SyncType = 'players' | 'teams' | 'games' | 'odds' | 'maintenance' | 'all';
const syncThrottleByType = new Map<string, number>();
const SYNC_THROTTLE_MS = Math.max(10_000, Number(process.env.SYNC_THROTTLE_MS || 60_000));

function isAuthorized(request: Request): boolean {
  const secret = String(process.env.SYNC_ADMIN_SECRET || '').trim();
  if (!secret) return true;
  const header = request.headers.get('x-sync-secret') || '';
  const bearer = request.headers.get('authorization') || '';
  if (header && header === secret) return true;
  if (bearer.toLowerCase().startsWith('bearer ') && bearer.slice(7).trim() === secret) return true;
  return false;
}

function checkThrottle(type: SyncType, force = false): { allowed: boolean; waitMs?: number } {
  if (force) return { allowed: true };
  const now = Date.now();
  const lastAt = syncThrottleByType.get(type) || 0;
  const elapsed = now - lastAt;
  if (elapsed < SYNC_THROTTLE_MS) return { allowed: false, waitMs: SYNC_THROTTLE_MS - elapsed };
  syncThrottleByType.set(type, now);
  return { allowed: true };
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized sync request' }, { status: 401 });
    }

    const body = await request.json();
    const { type = 'all', force = false } = body as { type?: SyncType; force?: boolean };
    const normalizedType: SyncType = (['players', 'teams', 'games', 'odds', 'maintenance', 'all'].includes(String(type))
      ? String(type)
      : 'all') as SyncType;

    const throttle = checkThrottle(normalizedType, Boolean(force));
    if (!throttle.allowed) {
      return NextResponse.json({
        success: false,
        error: `Throttled. Try again in ${Math.ceil((throttle.waitMs || 0) / 1000)}s`,
        type: normalizedType,
      }, { status: 429 });
    }

    const orchestrator = getDataOrchestrator();

    console.log('=== SYNC API ===');
    console.log('Type:', normalizedType);

    const output: Record<string, any> = {};

    switch (normalizedType) {
      case 'players':
        output.players = await syncPlayers(orchestrator, Boolean(force));
        break;
      case 'teams':
        output.teams = await syncTeams(orchestrator, Boolean(force));
        break;
      case 'games':
        output.games = await syncGames(orchestrator, Boolean(force));
        break;
      case 'odds':
        output.odds = await syncOdds();
        break;
      case 'maintenance':
        output.maintenance = await syncMaintenance();
        break;
      case 'all':
      default:
        output.players = await syncPlayers(orchestrator, Boolean(force));
        output.teams = await syncTeams(orchestrator, Boolean(force));
        output.games = await syncGames(orchestrator, Boolean(force));
        output.odds = await syncOdds();
        output.maintenance = await syncMaintenance();
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed for: ${normalizedType}`,
      type: normalizedType,
      output,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function syncPlayers(orchestrator: ReturnType<typeof getDataOrchestrator>, forceRefresh: boolean) {
  console.log('Syncing players...');
  const season = process.env.NBA_SEASON;
  const result = await orchestrator.getPlayers(season, { forceRefresh });
  return {
    total: Array.isArray(result.data) ? result.data.length : 0,
    source: result.source,
    sourceHealth: result.sourceHealth,
    cacheStatus: result.cacheStatus,
    warning: result.warning,
    errorCode: result.errorCode,
    capturedAt: new Date().toISOString(),
  };
}

async function syncTeams(orchestrator: ReturnType<typeof getDataOrchestrator>, forceRefresh: boolean) {
  console.log('Syncing teams...');
  const season = process.env.NBA_SEASON;
  const result = await orchestrator.getTeams(season, { forceRefresh });
  return {
    total: Array.isArray(result.data) ? result.data.length : 0,
    source: result.source,
    sourceHealth: result.sourceHealth,
    cacheStatus: result.cacheStatus,
    warning: result.warning,
    errorCode: result.errorCode,
    capturedAt: new Date().toISOString(),
  };
}

async function syncGames(orchestrator: ReturnType<typeof getDataOrchestrator>, forceRefresh: boolean) {
  console.log('Syncing games...');
  const result = await orchestrator.getGamesToday(undefined, { forceRefresh });
  return {
    total: Array.isArray(result.data) ? result.data.length : 0,
    source: result.source,
    sourceHealth: result.sourceHealth,
    cacheStatus: result.cacheStatus,
    warning: result.warning,
    errorCode: result.errorCode,
    capturedAt: new Date().toISOString(),
  };
}

async function syncOdds() {
  console.log('Syncing odds snapshots...');
  const result = await collectBoltOddsMarketSnapshots({
    apiKey: process.env.BOLTODDS_API_KEY,
    sports: ['NBA'],
    durationSec: 20,
    maxMessages: 600,
  });
  console.log(`Captured odds snapshots: inserted=${result.inserted}, total=${result.totalSnapshots}, parsed=${result.parsedMarkets}`);
  return {
    inserted: result.inserted,
    totalSnapshots: result.totalSnapshots,
    parsedMarkets: result.parsedMarkets,
    warning: result.warning,
    capturedAt: new Date().toISOString(),
  };
}

async function syncMaintenance() {
  const deletedSnapshots = await pruneExpired();
  return {
    deletedSnapshots,
    capturedAt: new Date().toISOString(),
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger sync',
    availableTypes: ['players', 'teams', 'games', 'odds', 'maintenance', 'all'],
    example: {
      type: 'POST',
      body: JSON.stringify({ type: 'all', force: false }),
    },
    cronRecommendation: {
      games: '*/10 * * * *',
      players: '*/30 * * * *',
      teams: '0 * * * *',
      maintenance: '15 * * * *',
    },
  });
}
