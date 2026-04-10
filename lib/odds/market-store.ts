import { promises as fs } from 'fs';
import path from 'path';
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
