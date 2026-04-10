import { getLocalISODate } from '@/lib/date-utils';

type AnyRecord = Record<string, any>;

const BOLTODDS_BASE_URL = 'https://spro.agency/api';

export type BoltOddsResult<T> = {
  data: T;
  source: 'boltodds' | 'none';
  warning?: string;
  errorCode?: 'UPSTREAM_UNAUTHORIZED' | 'UPSTREAM_RATE_LIMIT' | 'UPSTREAM_UNAVAILABLE' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_BAD_RESPONSE';
};

function toErrorCode(status?: number): BoltOddsResult<never>['errorCode'] {
  if (status === 401 || status === 403) return 'UPSTREAM_UNAUTHORIZED';
  if (status === 429) return 'UPSTREAM_RATE_LIMIT';
  if (status && status >= 500) return 'UPSTREAM_UNAVAILABLE';
  return 'UPSTREAM_BAD_RESPONSE';
}

function getTodayISO(): string {
  return getLocalISODate();
}

function parseGameKey(gameKey: string): { homeTeam: string; awayTeam: string; date: string } | null {
  const parts = gameKey.split(',').map((p) => p.trim());
  if (parts.length < 2) return null;
  const teamsPart = parts[0];
  const datePart = parts[1];
  const teams = teamsPart.split(' vs ').map((t) => t.trim());
  if (teams.length !== 2) return null;
  return { homeTeam: teams[0], awayTeam: teams[1], date: datePart };
}

async function getJson<T>(url: string): Promise<BoltOddsResult<T>> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return {
        data: [] as T,
        source: 'none',
        warning: `BoltOdds unavailable (status ${response.status})`,
        errorCode: toErrorCode(response.status),
      };
    }
    const json = await response.json();
    return { data: json as T, source: 'boltodds' };
  } catch (error: any) {
    return {
      data: [] as T,
      source: 'none',
      warning: `BoltOdds unavailable (${error?.message || 'network error'})`,
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }
}

export async function getBoltOddsNBAGamesToday(apiKey?: string): Promise<BoltOddsResult<AnyRecord[]>> {
  if (!apiKey) {
    return {
      data: [],
      source: 'none',
      warning: 'BOLTODDS_API_KEY is missing',
      errorCode: 'UPSTREAM_UNAUTHORIZED',
    };
  }

  const url = `${BOLTODDS_BASE_URL}/get_games?key=${encodeURIComponent(apiKey)}`;
  const result = await getJson<Record<string, AnyRecord>>(url);
  const payload = result.data || {};
  const today = getTodayISO();

  const mapped = Object.entries(payload)
    .filter(([, game]) => String(game?.sport || '').toUpperCase() === 'NBA')
    .filter(([, game]) => String(game?.when || '').includes(today) || String(game?.game || '').includes(today))
    .map(([gameKey, game]) => {
      const parsed = parseGameKey(gameKey);
      return {
        id: String(game?.universal_id || gameKey),
        gameId: String(game?.universal_id || gameKey),
        status: 'scheduled',
        GameStatus: 1,
        date: parsed?.date || today,
        gameTime: game?.when || '',
        homeTeam: {
          id: '',
          abbreviation: parsed?.homeTeam?.slice(0, 3).toUpperCase() || 'HOME',
          name: parsed?.homeTeam || 'Home',
          city: '',
        },
        awayTeam: {
          id: '',
          abbreviation: parsed?.awayTeam?.slice(0, 3).toUpperCase() || 'AWAY',
          name: parsed?.awayTeam || 'Away',
          city: '',
        },
        homeScore: 0,
        awayScore: 0,
        boltOddsGameKey: gameKey,
        boltOddsSport: game?.sport || 'NBA',
      };
    });

  return {
    data: mapped,
    source: mapped.length > 0 ? 'boltodds' : result.source,
    warning: mapped.length === 0 ? (result.warning || 'No NBA games returned by BoltOdds') : result.warning,
    errorCode: result.errorCode,
  };
}

export async function getBoltOddsBoxScoreByGameKey(apiKey: string | undefined, gameKey: string): Promise<BoltOddsResult<AnyRecord | null>> {
  if (!apiKey) {
    return {
      data: null,
      source: 'none',
      warning: 'BOLTODDS_API_KEY is missing',
      errorCode: 'UPSTREAM_UNAUTHORIZED',
    };
  }

  try {
    const response = await fetch(`${BOLTODDS_BASE_URL}/boxscores?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: [gameKey] }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        data: null,
        source: 'none',
        warning: `BoltOdds boxscore unavailable (status ${response.status})`,
        errorCode: toErrorCode(response.status),
      };
    }

    const json = (await response.json()) as Record<string, AnyRecord>;
    return {
      data: json?.[gameKey] || null,
      source: 'boltodds',
      warning: json?.[gameKey] ? undefined : 'Boxscore not found in BoltOdds response',
    };
  } catch (error: any) {
    return {
      data: null,
      source: 'none',
      warning: `BoltOdds boxscore unavailable (${error?.message || 'network error'})`,
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }
}

export async function getBoltOddsInfo(apiKey?: string): Promise<BoltOddsResult<AnyRecord>> {
  if (!apiKey) {
    return {
      data: {},
      source: 'none',
      warning: 'BOLTODDS_API_KEY is missing',
      errorCode: 'UPSTREAM_UNAUTHORIZED',
    };
  }

  const url = `${BOLTODDS_BASE_URL}/get_info?key=${encodeURIComponent(apiKey)}`;
  return getJson<AnyRecord>(url);
}

export async function getBoltOddsMarketsCatalog(
  apiKey: string | undefined,
  options?: { sports?: string[]; sportsbooks?: string[] }
): Promise<BoltOddsResult<AnyRecord>> {
  if (!apiKey) {
    return {
      data: {},
      source: 'none',
      warning: 'BOLTODDS_API_KEY is missing',
      errorCode: 'UPSTREAM_UNAUTHORIZED',
    };
  }

  const query = new URLSearchParams({ key: apiKey });
  if (options?.sports?.length) query.set('sports', options.sports.join(','));
  if (options?.sportsbooks?.length) query.set('sportsbooks', options.sportsbooks.join(','));
  const url = `${BOLTODDS_BASE_URL}/get_markets?${query.toString()}`;
  return getJson<AnyRecord>(url);
}
