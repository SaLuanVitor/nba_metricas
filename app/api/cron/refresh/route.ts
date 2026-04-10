import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { pruneExpired } from '@/lib/cache/snapshot-store';

function isAuthorized(request: Request): boolean {
  const secret = String(process.env.CRON_REFRESH_SECRET || process.env.SYNC_ADMIN_SECRET || '').trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  return auth.slice(7).trim() === secret;
}

type Domain = 'games' | 'players' | 'teams' | 'maintenance' | 'all';

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron refresh request' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const domain = (String(body?.domain || 'all') as Domain);
  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const output: Record<string, any> = {};

  if (domain === 'games' || domain === 'all') {
    const result = await orchestrator.getGamesToday(undefined, { forceRefresh: true });
    output.games = { total: result.data?.length || 0, source: result.source, sourceHealth: result.sourceHealth, cacheStatus: result.cacheStatus };
  }
  if (domain === 'players' || domain === 'all') {
    const result = await orchestrator.getPlayers(season, { forceRefresh: true });
    output.players = { total: result.data?.length || 0, source: result.source, sourceHealth: result.sourceHealth, cacheStatus: result.cacheStatus };
  }
  if (domain === 'teams' || domain === 'all') {
    const result = await orchestrator.getTeams(season, { forceRefresh: true });
    output.teams = { total: result.data?.length || 0, source: result.source, sourceHealth: result.sourceHealth, cacheStatus: result.cacheStatus };
  }
  if (domain === 'maintenance' || domain === 'all') {
    const deletedSnapshots = await pruneExpired();
    output.maintenance = { deletedSnapshots };
  }

  return NextResponse.json({
    success: true,
    domain,
    output,
    timestamp: new Date().toISOString(),
  });
}

