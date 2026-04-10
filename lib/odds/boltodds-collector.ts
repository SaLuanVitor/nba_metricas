import { appendMarketSnapshots, type MarketSnapshot, type MarketType } from '@/lib/odds/market-store';
import { americanOddsToImpliedProb } from '@/lib/odds/market-utils';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type AnyRecord = Record<string, any>;

type CollectOptions = {
  apiKey?: string;
  sports?: string[];
  sportsbooks?: string[];
  games?: string[];
  markets?: string[];
  durationSec?: number;
  maxMessages?: number;
};

type CollectResult = {
  success: boolean;
  inserted: number;
  totalSnapshots: number;
  receivedMessages: number;
  parsedMarkets: number;
  warning?: string;
  errorCode?: 'UPSTREAM_UNAUTHORIZED' | 'UPSTREAM_RATE_LIMIT' | 'UPSTREAM_UNAVAILABLE' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_BAD_RESPONSE';
};

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonLoose(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
}

function parseAmericanOdds(value: unknown): number | undefined {
  const str = String(value ?? '').trim();
  if (!str) return undefined;
  const n = Number(str);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function parseLine(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function marketTypeFromOutcome(name: string): MarketType | null {
  const normalized = normalizeName(name);
  if (normalized.includes('moneyline')) return 'moneyline';
  if (normalized.includes('spread')) return 'spread';
  if (normalized.includes('total')) return 'total';
  if (normalized.includes('point')) return 'player_points';
  if (normalized.includes('assist')) return 'player_assists';
  if (normalized.includes('rebound')) return 'player_rebounds';
  return null;
}

function sideFromOutcome(input: {
  marketType: MarketType;
  outcomeOverUnder?: string | null;
  outcomeTarget?: string | null;
  homeTeam?: string;
  awayTeam?: string;
}): MarketSnapshot['side'] {
  const overUnder = normalizeName(input.outcomeOverUnder || '');
  if (overUnder === 'over') return 'over';
  if (overUnder === 'under') return 'under';
  if (input.marketType === 'moneyline' || input.marketType === 'spread') {
    const target = normalizeName(input.outcomeTarget || '');
    if (target && target === normalizeName(input.homeTeam || '')) return 'home';
    if (target && target === normalizeName(input.awayTeam || '')) return 'away';
  }
  return 'player';
}

function isPlayerMarket(marketType: MarketType): boolean {
  return marketType === 'player_points' || marketType === 'player_assists' || marketType === 'player_rebounds';
}

function toMarketSnapshot(args: {
  message: AnyRecord;
  data: AnyRecord;
  outcomeLabel: string;
  outcome: AnyRecord;
  playerIdByName: Map<string, string>;
}): MarketSnapshot | null {
  const outcomeName = String(args.outcome?.outcome_name || '');
  const marketType = marketTypeFromOutcome(outcomeName);
  if (!marketType) return null;

  const gameRaw = String(args.data.game || args.data.info?.game || '');
  const gameId = String(args.data.info?.id || gameRaw);
  const sportsbook = String(args.data.sportsbook || 'unknown');
  const outcomeTarget = String(args.outcome?.outcome_target || '');
  const outcomeOverUnder = args.outcome?.outcome_over_under ?? null;
  const side = sideFromOutcome({
    marketType,
    outcomeOverUnder,
    outcomeTarget,
    homeTeam: String(args.data.home_team || ''),
    awayTeam: String(args.data.away_team || ''),
  });
  const line = parseLine(args.outcome?.outcome_line);
  const americanOdds = parseAmericanOdds(args.outcome?.odds);
  const impliedProb = Number.isFinite(americanOdds as number)
    ? americanOddsToImpliedProb(Number(americanOdds))
    : undefined;
  const playerName = isPlayerMarket(marketType) ? outcomeTarget || undefined : undefined;
  const playerId = playerName ? args.playerIdByName.get(normalizeName(playerName)) : undefined;
  const timestamp = String(args.message.timestamp || new Date().toISOString());

  const marketId = [
    gameId,
    sportsbook,
    marketType,
    side,
    playerId || normalizeName(playerName || ''),
    Number.isFinite(line as number) ? String(line) : '',
  ].join(':');

  return {
    marketId,
    gameId,
    marketType,
    side,
    playerId,
    playerName,
    sportsbook,
    line,
    americanOdds,
    impliedProb,
    timestamp,
    source: 'boltodds',
  };
}

export async function collectBoltOddsMarketSnapshots(options: CollectOptions = {}): Promise<CollectResult> {
  const apiKey = options.apiKey || process.env.BOLTODDS_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      inserted: 0,
      totalSnapshots: 0,
      receivedMessages: 0,
      parsedMarkets: 0,
      warning: 'BOLTODDS_API_KEY is missing',
      errorCode: 'UPSTREAM_UNAUTHORIZED',
    };
  }

  const durationSec = Math.max(5, Math.min(90, Number(options.durationSec || 25)));
  const maxMessages = Math.max(10, Math.min(5000, Number(options.maxMessages || 800)));
  const uri = `wss://spro.agency/api?key=${encodeURIComponent(apiKey)}`;
  const snapshots: MarketSnapshot[] = [];
  let receivedMessages = 0;
  let parsedMarkets = 0;

  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getPlayers(process.env.NBA_SEASON);
  const playerIdByName = new Map<string, string>();
  for (const player of playersResult.data || []) {
    playerIdByName.set(normalizeName(player.name), String(player.id));
  }

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(uri);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      resolve();
    }, durationSec * 1000);

    ws.addEventListener('open', () => {
      const payload = {
        action: 'subscribe',
        filters: {
          sports: options.sports?.length ? options.sports : ['NBA'],
          ...(options.sportsbooks?.length ? { sportsbooks: options.sportsbooks } : {}),
          ...(options.games?.length ? { games: options.games } : {}),
          ...(options.markets?.length ? { markets: options.markets } : {}),
        },
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // ignore
      }
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      receivedMessages += 1;
      const raw = String((event as any).data ?? '');
      const parsed = parseJsonLoose(raw);
      if (!parsed) return;
      const events: AnyRecord[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const msg of events) {
        const action = String(msg.action || '');
        if (!action || action === 'ping' || action === 'socket_connected' || action === 'subscription_updated') continue;
        const data = msg.data;
        if (!data || typeof data !== 'object') continue;
        if (String(data.sport || '').toUpperCase() !== 'NBA') continue;
        const outcomes = data.outcomes || {};
        for (const [label, outcome] of Object.entries(outcomes)) {
          const snap = toMarketSnapshot({
            message: msg,
            data,
            outcomeLabel: label,
            outcome: outcome as AnyRecord,
            playerIdByName,
          });
          if (!snap) continue;
          snapshots.push(snap);
          parsedMarkets += 1;
        }
      }

      if (receivedMessages >= maxMessages) {
        clearTimeout(timer);
        try {
          ws.close();
        } catch {}
        resolve();
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('BoltOdds websocket connection failed'));
    });

    ws.addEventListener('close', () => {
      clearTimeout(timer);
      resolve();
    });
  }).catch(async (error: any) => {
    if (snapshots.length > 0) return;
    throw error;
  });

  const persisted = await appendMarketSnapshots(snapshots);
  return {
    success: true,
    inserted: persisted.inserted,
    totalSnapshots: persisted.total,
    receivedMessages,
    parsedMarkets,
    warning: snapshots.length === 0 ? 'No NBA market snapshots captured in this collection window' : undefined,
  };
}

