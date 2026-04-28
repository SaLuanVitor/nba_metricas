import { promises as fs } from 'fs';
import path from 'path';
import { ensureOperationalTables, isPgConfigured, pgQuery } from '@/lib/db/pg';
import { americanOddsToImpliedProb } from '@/lib/odds/market-utils';

export type MarketType = 'moneyline' | 'spread' | 'total' | 'player_points' | 'player_assists' | 'player_rebounds';

export type MarketSnapshot = {
  marketId: string;
  gameId: string;
  marketType: MarketType;
  side: 'home' | 'away' | 'over' | 'under' | 'player';
  playerId?: string;
  playerName?: string;
  sportsbook: string;
  line?: number;
  americanOdds?: number;
  impliedProb?: number;
  timestamp: string;
  source: 'boltodds' | 'manual' | 'none';
};

type MarketStorePayload = {
  snapshots: MarketSnapshot[];
  updatedAt: string;
};

const MARKET_STORE_FILE = path.join(process.cwd(), '.cache', 'odds-market-lines.json');
const MAX_SNAPSHOTS = 20_000;
const RETENTION_DAYS = 14;

function normalizeSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
  const normalized: MarketSnapshot = { ...snapshot };
  if (!normalized.impliedProb && Number.isFinite(normalized.americanOdds)) {
    normalized.impliedProb = americanOddsToImpliedProb(Number(normalized.americanOdds));
  }
  return normalized;
}

export async function readMarketSnapshots(): Promise<MarketSnapshot[]> {
  if (isPgConfigured()) {
    try {
      await ensureOperationalTables();
      const rows = await pgQuery<{
        market_id: string;
        game_id: string;
        market_type: MarketType;
        side: MarketSnapshot['side'];
        player_id: string | null;
        player_name: string | null;
        sportsbook: string;
        line: string | number | null;
        american_odds: number | null;
        implied_prob: string | number | null;
        captured_at: string;
        source: MarketSnapshot['source'];
      }>(
        `
          SELECT market_id, game_id, market_type, side, player_id, player_name, sportsbook,
                 line, american_odds, implied_prob, captured_at, source
          FROM odds_snapshots
          WHERE captured_at >= NOW() - INTERVAL '14 days'
          ORDER BY captured_at ASC
          LIMIT $1
        `,
        [MAX_SNAPSHOTS]
      );
      return rows.map((row) => normalizeSnapshot({
        marketId: row.market_id,
        gameId: row.game_id,
        marketType: row.market_type,
        side: row.side,
        playerId: row.player_id || undefined,
        playerName: row.player_name || undefined,
        sportsbook: row.sportsbook,
        line: row.line === null ? undefined : Number(row.line),
        americanOdds: row.american_odds ?? undefined,
        impliedProb: row.implied_prob === null ? undefined : Number(row.implied_prob),
        timestamp: row.captured_at,
        source: row.source,
      }));
    } catch (error) {
      console.warn('[ODDS_DB_READ_FAILED] falling back to local cache', error);
    }
  }

  try {
    const raw = await fs.readFile(MARKET_STORE_FILE, 'utf-8');
    const payload = JSON.parse(raw) as MarketStorePayload;
    const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];
    return snapshots.map(normalizeSnapshot);
  } catch {
    return [];
  }
}

export async function writeMarketSnapshots(snapshots: MarketSnapshot[]): Promise<void> {
  const normalized = snapshots.map(normalizeSnapshot);
  if (isPgConfigured()) {
    try {
      await ensureOperationalTables();
      for (const snapshot of normalized) {
        await pgQuery(
          `
            INSERT INTO odds_snapshots (
              market_id, game_id, market_type, side, player_id, player_name, sportsbook,
              line, american_odds, implied_prob, source, captured_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz)
            ON CONFLICT (market_id, captured_at) DO NOTHING
          `,
          [
            snapshot.marketId,
            snapshot.gameId,
            snapshot.marketType,
            snapshot.side,
            snapshot.playerId || null,
            snapshot.playerName || null,
            snapshot.sportsbook,
            Number.isFinite(Number(snapshot.line)) ? Number(snapshot.line) : null,
            Number.isFinite(Number(snapshot.americanOdds)) ? Number(snapshot.americanOdds) : null,
            Number.isFinite(Number(snapshot.impliedProb)) ? Number(snapshot.impliedProb) : null,
            snapshot.source,
            snapshot.timestamp,
          ]
        );
      }
      if (process.env.NODE_ENV === 'production') return;
    } catch (error) {
      console.warn('[ODDS_DB_WRITE_FAILED] falling back to local cache', error);
    }
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const retained = normalized.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
  const capped = retained.slice(-MAX_SNAPSHOTS);
  const payload: MarketStorePayload = {
    snapshots: capped,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(MARKET_STORE_FILE), { recursive: true });
  await fs.writeFile(MARKET_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
}

export async function appendMarketSnapshots(incoming: MarketSnapshot[]): Promise<{ inserted: number; total: number }> {
  if (!incoming.length) {
    const existing = await readMarketSnapshots();
    return { inserted: 0, total: existing.length };
  }
  const existing = await readMarketSnapshots();
  const dedupe = new Set(existing.map((s) => `${s.marketId}:${s.timestamp}`));
  let inserted = 0;
  for (const snap of incoming) {
    const key = `${snap.marketId}:${snap.timestamp}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    existing.push(normalizeSnapshot(snap));
    inserted += 1;
  }
  await writeMarketSnapshots(existing);
  return { inserted, total: existing.length };
}

export async function getMarketSnapshotsByGame(gameId: string): Promise<MarketSnapshot[]> {
  const snapshots = await readMarketSnapshots();
  return snapshots.filter((s) => s.gameId === gameId);
}

export async function getPlayerMarketSnapshots(playerId: string, gameId?: string): Promise<MarketSnapshot[]> {
  const snapshots = await readMarketSnapshots();
  return snapshots.filter((s) => {
    if (s.playerId !== playerId) return false;
    if (gameId && s.gameId !== gameId) return false;
    return s.marketType === 'player_points' || s.marketType === 'player_assists' || s.marketType === 'player_rebounds';
  });
}

export async function getLatestPlayerMarketByType(
  playerId: string,
  marketType: 'player_points' | 'player_assists' | 'player_rebounds',
  gameId?: string
): Promise<MarketSnapshot | null> {
  const snapshots = await getPlayerMarketSnapshots(playerId, gameId);
  const filtered = snapshots.filter((s) => s.marketType === marketType);
  if (!filtered.length) return null;
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return filtered[0];
}

export async function getMarketMovements(marketId?: string): Promise<{
  snapshots: MarketSnapshot[];
  movements: Array<{
    marketId: string;
    marketType: MarketType;
    gameId: string;
    sportsbook: string;
    openedAt: string;
    latestAt: string;
    openLine?: number;
    latestLine?: number;
    lineDelta?: number;
    openOdds?: number;
    latestOdds?: number;
    oddsDelta?: number;
    sampleSize: number;
  }>;
}> {
  const snapshots = await readMarketSnapshots();
  const scoped = marketId ? snapshots.filter((s) => s.marketId === marketId) : snapshots;
  const byMarket = new Map<string, MarketSnapshot[]>();
  for (const snap of scoped) {
    if (!byMarket.has(snap.marketId)) byMarket.set(snap.marketId, []);
    byMarket.get(snap.marketId)!.push(snap);
  }

  const movements = Array.from(byMarket.entries()).map(([id, snaps]) => {
    const sorted = snaps.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const open = sorted[0];
    const latest = sorted[sorted.length - 1];
    const openLine = Number.isFinite(open.line) ? Number(open.line) : undefined;
    const latestLine = Number.isFinite(latest.line) ? Number(latest.line) : undefined;
    const openOdds = Number.isFinite(open.americanOdds) ? Number(open.americanOdds) : undefined;
    const latestOdds = Number.isFinite(latest.americanOdds) ? Number(latest.americanOdds) : undefined;
    return {
      marketId: id,
      marketType: latest.marketType,
      gameId: latest.gameId,
      sportsbook: latest.sportsbook,
      openedAt: open.timestamp,
      latestAt: latest.timestamp,
      openLine,
      latestLine,
      lineDelta: Number.isFinite(openLine) && Number.isFinite(latestLine) ? Number((latestLine! - openLine!).toFixed(2)) : undefined,
      openOdds,
      latestOdds,
      oddsDelta: Number.isFinite(openOdds) && Number.isFinite(latestOdds) ? Number((latestOdds! - openOdds!).toFixed(2)) : undefined,
      sampleSize: sorted.length,
    };
  });

  return { snapshots: scoped, movements };
}
