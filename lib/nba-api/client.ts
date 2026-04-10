import axios from 'axios';
import { generateProjection } from '@/lib/ai/engine';
import type { Player, PlayerStats, TeamWithStats } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';
import { getBoltOddsNBAGamesToday } from '@/lib/odds-api/boltodds';
import { getLocalISODate } from '@/lib/date-utils';
import { playerHeadshotUrl, teamLogoUrl } from '@/lib/media/nba-images';

const BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io/v1';

type AnyRecord = Record<string, any>;

export type UpstreamErrorCode =
  | 'UPSTREAM_UNAUTHORIZED'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_BAD_RESPONSE';

export type ProviderResult<T> = {
  data: T;
  source: 'balldontlie' | 'boltodds' | 'none';
  warning?: string;
  errorCode?: UpstreamErrorCode;
  meta?: AnyRecord;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type CacheStatus = 'fresh' | 'stale' | 'rejected';

type PlayersCacheMetadata = {
  season: number;
  coverageRatio: number;
  fetchedAt: string;
  sourceHealth: 'ok' | 'degraded';
  activePlayersCount: number;
  cacheStatus: CacheStatus;
};

const CACHE_TTL_MS = 1000 * 60 * 5;
const COVERAGE_MIN_THRESHOLD = 0.6;
const PLAYERS_PAGE_SIZE = 100;
const MAX_PLAYER_PAGES_COLD = 2;
const MAX_PLAYER_PAGES_WARM = 4;
const SEASON_AVERAGES_CHUNK_SIZE = 50;
const UPSTREAM_COOLDOWN_MS = 90_000;
const playersCacheBySeason = new Map<number, CacheEntry<Player[]>>();
const playersCacheMetaBySeason = new Map<number, PlayersCacheMetadata>();
const playersCooldownBySeason = new Map<number, number>();
let teamsCache: CacheEntry<TeamWithStats[]> | null = null;
const playersInflightBySeason = new Map<number, Promise<ProviderResult<Player[]>>>();
let teamsInflight: Promise<ProviderResult<TeamWithStats[]>> | null = null;
const PERSISTED_CACHE_FILE = path.join(process.cwd(), '.cache', 'balldontlie-cache.json');

let persistedCacheLoaded = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasStatSignal(player: Player): boolean {
  return (player.seasonStats.minutes || 0) > 0 || (player.seasonStats.points || 0) > 0;
}

function isContaminatedPlayersSnapshot(players: Player[], coverageRatio: number): boolean {
  if (players.length === 0) return false;
  const allZeroPoints = players.every((p) => (p.seasonStats.points || 0) === 0);
  return coverageRatio < COVERAGE_MIN_THRESHOLD || allZeroPoints;
}

async function loadPersistedCache(): Promise<void> {
  if (persistedCacheLoaded) return;
  persistedCacheLoaded = true;
  try {
    const raw = await fs.readFile(PERSISTED_CACHE_FILE, 'utf-8');
    const payload = JSON.parse(raw) as {
      playersBySeason?: Record<string, Player[]>;
      playersMetaBySeason?: Record<string, PlayersCacheMetadata>;
      teams?: TeamWithStats[];
    };
    const now = Date.now();
    for (const [season, players] of Object.entries(payload.playersBySeason || {})) {
      const seasonNum = Number(season);
      const cacheMeta = payload.playersMetaBySeason?.[season];
      const coverageRatio = Number(cacheMeta?.coverageRatio || 0);
      const isValidSnapshot = Number.isFinite(seasonNum)
        && Array.isArray(players)
        && players.length > 0
        && !isContaminatedPlayersSnapshot(players, coverageRatio);

      if (isValidSnapshot) {
        playersCacheBySeason.set(seasonNum, {
          value: players.filter(hasStatSignal),
          expiresAt: now + CACHE_TTL_MS,
        });
        playersCacheMetaBySeason.set(seasonNum, {
          season: seasonNum,
          coverageRatio,
          fetchedAt: cacheMeta?.fetchedAt || new Date().toISOString(),
          sourceHealth: cacheMeta?.sourceHealth || 'degraded',
          activePlayersCount: cacheMeta?.activePlayersCount || players.filter(hasStatSignal).length,
          cacheStatus: 'stale',
        });
      } else if (Array.isArray(players) && players.length > 0) {
        console.warn(`[CACHE_REJECTED_LOW_COVERAGE] season=${seasonNum} coverage=${coverageRatio.toFixed(2)}`);
      }
    }
    if (Array.isArray(payload.teams) && payload.teams.length > 0) {
      teamsCache = { value: payload.teams, expiresAt: now + CACHE_TTL_MS };
    }
  } catch {
    // no persisted cache yet
  }
}

async function persistCache(): Promise<void> {
  try {
    const playersBySeason: Record<string, Player[]> = {};
    const playersMetaBySeason: Record<string, PlayersCacheMetadata> = {};
    for (const [season, entry] of playersCacheBySeason.entries()) {
      if (entry.value.length > 0) {
        playersBySeason[String(season)] = entry.value;
        const meta = playersCacheMetaBySeason.get(season);
        if (meta) playersMetaBySeason[String(season)] = meta;
      }
    }
    const payload = {
      playersBySeason,
      playersMetaBySeason,
      teams: teamsCache?.value || [],
      updatedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(PERSISTED_CACHE_FILE), { recursive: true });
    await fs.writeFile(PERSISTED_CACHE_FILE, JSON.stringify(payload), 'utf-8');
  } catch (error: any) {
    console.warn(`[UPSTREAM_BAD_RESPONSE] endpoint=/cache details=persist failed ${error?.message || 'unknown'}`);
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCurrentNbaSeasonStartYear(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return month >= 9 ? year : year - 1;
}

function normalizeSeason(season?: string): number {
  if (!season) return getCurrentNbaSeasonStartYear();
  const parsed = Number(String(season).slice(0, 4));
  return Number.isFinite(parsed) ? parsed : getCurrentNbaSeasonStartYear();
}

function getTeamColors(abbreviation: string) {
  const palette = ['#1D428A', '#C8102E', '#007A33', '#FDB927', '#006BB6', '#98002E', '#0E2240', '#5A2D81'];
  const hash = abbreviation.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const primaryColor = palette[hash % palette.length];
  const secondaryColor = palette[(hash + 3) % palette.length];
  return { primaryColor, secondaryColor };
}

function normalizePosition(raw: string): Player['position'] {
  const pos = (raw || '').toUpperCase();
  if (pos.includes('PG')) return 'PG';
  if (pos.includes('SG')) return 'SG';
  if (pos.includes('SF')) return 'SF';
  if (pos.includes('PF')) return 'PF';
  if (pos.includes('C')) return 'C';
  return 'SG';
}

function classifyUpstreamError(error: any): { code: UpstreamErrorCode; message: string } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return { code: 'UPSTREAM_UNAUTHORIZED', message: `status ${status}` };
    if (status === 429) return { code: 'UPSTREAM_RATE_LIMIT', message: 'status 429' };
    if (status && status >= 500) return { code: 'UPSTREAM_UNAVAILABLE', message: `status ${status}` };
    if (error.code === 'ECONNABORTED') return { code: 'UPSTREAM_TIMEOUT', message: 'timeout' };
    return { code: 'UPSTREAM_BAD_RESPONSE', message: status ? `status ${status}` : error.message };
  }
  return { code: 'UPSTREAM_BAD_RESPONSE', message: error?.message || 'unknown error' };
}

function logUpstream(endpoint: string, code: UpstreamErrorCode, details: string) {
  console.warn(`[${code}] endpoint=${endpoint} details=${details}`);
}

function shouldRetry(code: UpstreamErrorCode): boolean {
  return code === 'UPSTREAM_TIMEOUT' || code === 'UPSTREAM_RATE_LIMIT' || code === 'UPSTREAM_UNAVAILABLE';
}

async function requestBallDontLie<T = any>(
  endpoint: string,
  params: AnyRecord,
  apiKey: string | undefined,
  retries = 1
): Promise<ProviderResult<T>> {
  if (!apiKey) {
    const warning = 'BALLDONTLIE_API_KEY is missing';
    logUpstream(endpoint, 'UPSTREAM_UNAUTHORIZED', warning);
    return { data: [] as T, source: 'none', warning, errorCode: 'UPSTREAM_UNAUTHORIZED' };
  }

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await axios.get(`${BALLDONTLIE_BASE_URL}${endpoint}`, {
        params,
        timeout: 10000,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { data: response.data as T, source: 'balldontlie' };
    } catch (error: any) {
      const { code, message } = classifyUpstreamError(error);
      const isLastAttempt = attempt >= retries || !shouldRetry(code);
      logUpstream(endpoint, code, `attempt=${attempt + 1} ${message}`);
      if (isLastAttempt) {
        return {
          data: [] as T,
          source: 'none',
          warning: `BallDontLie unavailable (${code})`,
          errorCode: code,
        };
      }
      const jitterMs = Math.floor(Math.random() * 120);
      const backoffMs = Math.min(600, 150 * (attempt + 1)) + jitterMs;
      await sleep(backoffMs);
      attempt += 1;
    }
  }

  return {
    data: [] as T,
    source: 'none',
    warning: 'BallDontLie unavailable (UPSTREAM_BAD_RESPONSE)',
    errorCode: 'UPSTREAM_BAD_RESPONSE',
  };
}

function mapSeasonAverages(payload: any): Map<number, AnyRecord> {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const mapped = new Map<number, AnyRecord>();
  for (const row of list) {
    const playerId = toNumber(row.player_id);
    if (playerId > 0) mapped.set(playerId, row);
  }
  return mapped;
}

async function fetchPlayersPages(apiKey: string | undefined, maxPages: number): Promise<ProviderResult<AnyRecord[]>> {
  const collected: AnyRecord[] = [];
  let cursor: number | null = 0;
  let warning: string | undefined;
  let errorCode: UpstreamErrorCode | undefined;
  let source: 'balldontlie' | 'boltodds' | 'none' = 'balldontlie';

  for (let page = 0; page < maxPages && cursor !== null; page += 1) {
    const pageResult: ProviderResult<{ data: AnyRecord[]; meta?: AnyRecord }> = await requestBallDontLie<{
      data: AnyRecord[];
      meta?: AnyRecord;
    }>(
      '/players',
      { per_page: PLAYERS_PAGE_SIZE, cursor },
      apiKey
    );

    const list = Array.isArray((pageResult.data as any)?.data) ? (pageResult.data as any).data : [];
    if (list.length === 0) {
      warning = warning || pageResult.warning;
      errorCode = errorCode || pageResult.errorCode;
      source = pageResult.source;
      break;
    }

    collected.push(...list);
    const nextCursor: unknown = (pageResult.data as any)?.meta?.next_cursor;
    cursor = Number.isFinite(Number(nextCursor)) ? Number(nextCursor) : null;
    if (cursor !== null) {
      await sleep(90);
    }
  }

  return { data: collected, source, warning, errorCode };
}

async function fetchSeasonAveragesChunked(
  apiKey: string | undefined,
  season: number,
  playerIds: number[]
): Promise<ProviderResult<Map<number, AnyRecord>>> {
  const seasonAvgByPlayerId = new Map<number, AnyRecord>();
  let warning: string | undefined;
  let errorCode: UpstreamErrorCode | undefined;

  for (let i = 0; i < playerIds.length; i += SEASON_AVERAGES_CHUNK_SIZE) {
    const chunk = playerIds.slice(i, i + SEASON_AVERAGES_CHUNK_SIZE);
    const result = await requestBallDontLie<{ data: AnyRecord[] }>(
      '/season_averages',
      { season, player_ids: chunk },
      apiKey
    );

    const mapped = mapSeasonAverages(result.data);
    for (const [pid, row] of mapped.entries()) {
      seasonAvgByPlayerId.set(pid, row);
    }
    warning = warning || result.warning;
    errorCode = errorCode || result.errorCode;
    await sleep(70);
  }

  return { data: seasonAvgByPlayerId, source: 'balldontlie', warning, errorCode };
}

function mapPlayers(playersRaw: AnyRecord[], seasonAvgByPlayerId: Map<number, AnyRecord>, teamsById?: Map<number, TeamWithStats>): Player[] {
  return playersRaw.map((entry) => {
    const playerId = toNumber(entry.id);
    const seasonAvg = seasonAvgByPlayerId.get(playerId) || {};
    const teamIdNum = toNumber(entry.team?.id, 0);
    const teamAbbreviation = String(entry.team?.abbreviation || 'NBA');
    const colors = getTeamColors(teamAbbreviation);
    const team = teamsById?.get(teamIdNum) || {
      id: teamAbbreviation.toLowerCase(),
      name: String(entry.team?.name || teamAbbreviation),
      abbreviation: teamAbbreviation,
      logoUrl: teamLogoUrl({ id: String(entry.team?.id || ''), abbreviation: teamAbbreviation }),
      city: String(entry.team?.city || ''),
      conference: 'West' as const,
      division: 'Unknown',
      primaryColor: colors.primaryColor,
      secondaryColor: colors.secondaryColor,
      stats: {
        wins: 0,
        losses: 0,
        pointsPerGame: 0,
        assistsPerGame: 0,
        reboundsPerGame: 0,
        stealsPerGame: 0,
        blocksPerGame: 0,
        turnoversPerGame: 0,
        fieldGoalPercentage: 0,
        threePointPercentage: 0,
        freeThrowPercentage: 0,
        offensiveRating: 0,
        defensiveRating: 0,
        pace: 0,
      },
      streak: 'N/A',
      lastGames: ['W', 'L', 'W', 'L', 'W'] as ('W' | 'L')[],
      rank: { conference: 0, overall: 0 },
    };

    const seasonStats: PlayerStats = {
      points: toNumber(seasonAvg.pts),
      assists: toNumber(seasonAvg.ast),
      rebounds: toNumber(seasonAvg.reb),
      minutes: toNumber(seasonAvg.min),
      fieldGoalPercentage: toNumber(seasonAvg.fg_pct) * 100,
      threePointPercentage: toNumber(seasonAvg.fg3_pct) * 100,
      freeThrowPercentage: toNumber(seasonAvg.ft_pct) * 100,
      steals: toNumber(seasonAvg.stl),
      blocks: toNumber(seasonAvg.blk),
      turnovers: toNumber(seasonAvg.turnover),
    };

    const projection = generateProjection({
      id: String(playerId),
      seasonStats,
      last5Games: [],
      injury: undefined,
    } as unknown as Player);

    const firstName = String(entry.first_name || '').trim();
    const lastName = String(entry.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || `Player ${playerId}`;

    return {
      id: String(playerId),
      name: fullName,
      firstName,
      lastName,
      number: 0,
      position: normalizePosition(String(entry.position || '')),
      team: {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        city: team.city,
        conference: team.conference,
        division: team.division,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
      height: "6'6\"",
      weight: 215,
      age: 27,
      experience: 1,
      college: 'N/A',
      imageUrl: playerHeadshotUrl(String(playerId)),
      seasonStats,
      last5Games: [],
      projection: {
        projectedPoints: projection.projectedPoints,
        projectedAssists: projection.projectedAssists,
        projectedRebounds: projection.projectedRebounds,
        projectedMinutes: projection.projectedMinutes,
        confidence: projection.confidence,
        trend: projection.trend,
      },
      fantasyPoints: Number((seasonStats.points + seasonStats.rebounds * 1.2 + seasonStats.assists * 1.5).toFixed(1)),
      salary: Math.round(5000 + seasonStats.points * 220),
    };
  });
}

function mapTeams(rawTeams: AnyRecord[]): TeamWithStats[] {
  return rawTeams.map((teamRow) => {
    const abbreviation = String(teamRow.abbreviation || 'NBA');
    const colors = getTeamColors(abbreviation);
    return {
      id: abbreviation.toLowerCase(),
      name: String(teamRow.name || abbreviation),
      abbreviation,
      logoUrl: teamLogoUrl({ id: String(teamRow.id || ''), abbreviation }),
      city: String(teamRow.city || ''),
      conference: 'West',
      division: String(teamRow.division || 'Unknown'),
      primaryColor: colors.primaryColor,
      secondaryColor: colors.secondaryColor,
      stats: {
        wins: 0,
        losses: 0,
        pointsPerGame: 0,
        assistsPerGame: 0,
        reboundsPerGame: 0,
        stealsPerGame: 0,
        blocksPerGame: 0,
        turnoversPerGame: 0,
        fieldGoalPercentage: 0,
        threePointPercentage: 0,
        freeThrowPercentage: 0,
        offensiveRating: 0,
        defensiveRating: 0,
        pace: 0,
      },
      streak: 'N/A',
      lastGames: ['W', 'L', 'W', 'L', 'W'],
      rank: { conference: 0, overall: 0 },
      TEAM_ID: teamRow.id,
      TEAM_NAME: teamRow.name,
      TEAM_ABBREVIATION: teamRow.abbreviation,
    } as TeamWithStats & AnyRecord;
  });
}

function getTodayISO(): string {
  return getLocalISODate();
}

export class NBAStatsClient {
  private readonly apiKey = process.env.BALLDONTLIE_API_KEY;

  async getPlayersWithMeta(season?: string): Promise<ProviderResult<Player[]>> {
    await loadPersistedCache();
    const activeSeason = normalizeSeason(season);
    const inflight = playersInflightBySeason.get(activeSeason);
    if (inflight) return inflight;

    const task = this.getPlayersWithMetaInternal(activeSeason);
    playersInflightBySeason.set(activeSeason, task);
    try {
      return await task;
    } finally {
      playersInflightBySeason.delete(activeSeason);
    }
  }

  private async getPlayersWithMetaInternal(activeSeason: number): Promise<ProviderResult<Player[]>> {
    const cachedPlayers = playersCacheBySeason.get(activeSeason);
    const cachedMeta = playersCacheMetaBySeason.get(activeSeason);
    const now = Date.now();
    const cooldownUntil = playersCooldownBySeason.get(activeSeason) || 0;
    if (cachedPlayers && cachedPlayers.expiresAt > now) {
      return {
        data: cachedPlayers.value,
        source: 'balldontlie',
        warning: 'Using cached players data',
        meta: {
          statsCoverage: cachedMeta?.coverageRatio || 0,
          activePlayersCount: cachedMeta?.activePlayersCount || cachedPlayers.value.length,
          cacheStatus: 'stale',
          sourceHealth: 'degraded',
        },
      };
    }

    if (cooldownUntil > now) {
      if (cachedPlayers?.value?.length) {
        console.warn(`[CACHE_STALE_SERVED] season=${activeSeason} reason=cooldown`);
        return {
          data: cachedPlayers.value,
          source: 'balldontlie',
          warning: 'Upstream cooldown active after rate limit. Using stale cached players data',
          errorCode: 'UPSTREAM_RATE_LIMIT',
          meta: {
            statsCoverage: cachedMeta?.coverageRatio || 0,
            activePlayersCount: cachedMeta?.activePlayersCount || cachedPlayers.value.length,
            cacheStatus: 'stale',
            sourceHealth: 'degraded',
          },
        };
      }
    }

    const maxPages = cachedPlayers?.value?.length ? MAX_PLAYER_PAGES_WARM : MAX_PLAYER_PAGES_COLD;
    const playersResponse = await fetchPlayersPages(this.apiKey, maxPages);
    if (playersResponse.errorCode === 'UPSTREAM_RATE_LIMIT') {
      playersCooldownBySeason.set(activeSeason, now + UPSTREAM_COOLDOWN_MS);
    }

    const playersRaw = Array.isArray(playersResponse.data) ? playersResponse.data : [];
    if (playersRaw.length === 0) {
      if (cachedPlayers) {
        console.warn(`[CACHE_STALE_SERVED] season=${activeSeason} reason=players_empty`);
        return {
          data: cachedPlayers.value,
          source: 'balldontlie',
          warning: playersResponse.warning
            ? `${playersResponse.warning}. Using stale cached players data`
            : 'Using stale cached players data',
          errorCode: playersResponse.errorCode,
          meta: {
            statsCoverage: cachedMeta?.coverageRatio || 0,
            activePlayersCount: cachedMeta?.activePlayersCount || cachedPlayers.value.length,
            cacheStatus: 'stale',
            sourceHealth: 'degraded',
          },
        };
      }

      return {
        data: [],
        source: playersResponse.source,
        warning: playersResponse.warning || 'No players returned by BallDontLie',
        errorCode: playersResponse.errorCode,
        meta: {
          statsCoverage: 0,
          activePlayersCount: 0,
          cacheStatus: 'rejected',
          sourceHealth: 'degraded',
        },
      };
    }

    const playerIds = Array.from(new Set(playersRaw.map((p) => toNumber(p.id)).filter((id) => id > 0)));
    const averagesResult = await fetchSeasonAveragesChunked(this.apiKey, activeSeason, playerIds);

    const seasonAvgByPlayerId = averagesResult.data;
    const coverageRatio = playerIds.length > 0 ? seasonAvgByPlayerId.size / playerIds.length : 0;
    const mapped = mapPlayers(playersRaw, seasonAvgByPlayerId);
    const activePlayers = mapped.filter(hasStatSignal);

    if (activePlayers.length === 0) {
      console.warn(
        `[CACHE_REJECTED_LOW_COVERAGE] season=${activeSeason} coverage=${coverageRatio.toFixed(2)} active=${activePlayers.length}`
      );
      if (averagesResult.errorCode === 'UPSTREAM_RATE_LIMIT') {
        playersCooldownBySeason.set(activeSeason, Date.now() + UPSTREAM_COOLDOWN_MS);
      }
      if (cachedPlayers) {
        console.warn(`[CACHE_STALE_SERVED] season=${activeSeason} reason=no_active_players`);
        return {
          data: cachedPlayers.value,
          source: 'balldontlie',
          warning: 'Low season averages coverage from BallDontLie. Using stale cached players data',
          errorCode: averagesResult.errorCode || playersResponse.errorCode,
          meta: {
            statsCoverage: cachedMeta?.coverageRatio || 0,
            activePlayersCount: cachedMeta?.activePlayersCount || cachedPlayers.value.length,
            cacheStatus: 'stale',
            sourceHealth: 'degraded',
          },
        };
      }

      return {
        data: [],
        source: 'none',
        warning: 'Low season averages coverage from BallDontLie. Snapshot rejected',
        errorCode: averagesResult.errorCode || playersResponse.errorCode,
        meta: {
          statsCoverage: coverageRatio,
          activePlayersCount: activePlayers.length,
          cacheStatus: 'rejected',
          sourceHealth: 'degraded',
        },
      };
    }

    if (coverageRatio < COVERAGE_MIN_THRESHOLD) {
      console.warn(
        `[CACHE_REJECTED_LOW_COVERAGE] season=${activeSeason} coverage=${coverageRatio.toFixed(2)} active=${activePlayers.length}`
      );
      if (cachedPlayers) {
        console.warn(`[CACHE_STALE_SERVED] season=${activeSeason} reason=low_coverage`);
        return {
          data: cachedPlayers.value,
          source: 'balldontlie',
          warning:
            `Low season averages coverage (${coverageRatio.toFixed(2)}) from BallDontLie. Using stale cached players data`,
          errorCode: averagesResult.errorCode || playersResponse.errorCode,
          meta: {
            statsCoverage: cachedMeta?.coverageRatio || coverageRatio,
            activePlayersCount: cachedMeta?.activePlayersCount || cachedPlayers.value.length,
            cacheStatus: 'stale',
            sourceHealth: 'degraded',
          },
        };
      }

      playersCacheBySeason.set(activeSeason, {
        value: activePlayers,
        expiresAt: now + CACHE_TTL_MS,
      });
      playersCacheMetaBySeason.set(activeSeason, {
        season: activeSeason,
        coverageRatio,
        fetchedAt: new Date().toISOString(),
        sourceHealth: 'degraded',
        activePlayersCount: activePlayers.length,
        cacheStatus: 'rejected',
      });
      void persistCache();

      return {
        data: activePlayers,
        source: 'balldontlie',
        warning:
          `Low season averages coverage (${coverageRatio.toFixed(2)}) from BallDontLie. Returning partial active players`,
        errorCode: averagesResult.errorCode || playersResponse.errorCode,
        meta: {
          statsCoverage: coverageRatio,
          activePlayersCount: activePlayers.length,
          cacheStatus: 'rejected',
          sourceHealth: 'degraded',
        },
      };
    }

    playersCacheBySeason.set(activeSeason, {
      value: activePlayers,
      expiresAt: now + CACHE_TTL_MS,
    });
    playersCacheMetaBySeason.set(activeSeason, {
      season: activeSeason,
      coverageRatio,
      fetchedAt: new Date().toISOString(),
      sourceHealth: 'ok',
      activePlayersCount: activePlayers.length,
      cacheStatus: 'fresh',
    });
    void persistCache();

    const warning = playersResponse.warning || averagesResult.warning;
    const errorCode = playersResponse.errorCode || averagesResult.errorCode;
    return {
      data: activePlayers,
      source: 'balldontlie',
      warning,
      errorCode,
      meta: {
        statsCoverage: coverageRatio,
        activePlayersCount: activePlayers.length,
        cacheStatus: 'fresh',
        sourceHealth: 'ok',
      },
    };
  }

  async getTeamsWithMeta(): Promise<ProviderResult<TeamWithStats[]>> {
    await loadPersistedCache();
    if (teamsInflight) return teamsInflight;
    const task = this.getTeamsWithMetaInternal();
    teamsInflight = task;
    try {
      return await task;
    } finally {
      teamsInflight = null;
    }
  }

  private async getTeamsWithMetaInternal(): Promise<ProviderResult<TeamWithStats[]>> {
    const now = Date.now();
    if (teamsCache && teamsCache.expiresAt > now) {
      return {
        data: teamsCache.value,
        source: 'balldontlie',
        warning: 'Using cached teams data',
      };
    }

    const response = await requestBallDontLie<{ data: AnyRecord[] }>(
      '/teams',
      { per_page: 100 },
      this.apiKey
    );

    const teamsRaw = Array.isArray((response.data as any)?.data) ? (response.data as any).data : [];
    if (teamsRaw.length === 0) {
      if (teamsCache) {
        return {
          data: teamsCache.value,
          source: 'balldontlie',
          warning: response.warning
            ? `${response.warning}. Using stale cached teams data`
            : 'Using stale cached teams data',
          errorCode: response.errorCode,
        };
      }

      return {
        data: [],
        source: response.source,
        warning: response.warning || 'No teams returned by BallDontLie',
        errorCode: response.errorCode,
      };
    }

    const mappedTeams = mapTeams(teamsRaw);
    teamsCache = {
      value: mappedTeams,
      expiresAt: now + CACHE_TTL_MS,
    };
    void persistCache();

    return { data: mappedTeams, source: 'balldontlie', warning: response.warning };
  }

  async getTodaysGamesWithMeta(dateISO: string = getTodayISO()): Promise<ProviderResult<AnyRecord[]>> {
    const response = await requestBallDontLie<{ data: AnyRecord[] }>(
      '/games',
      { dates: [dateISO], per_page: 25 },
      this.apiKey
    );

    const gamesRaw = Array.isArray((response.data as any)?.data) ? (response.data as any).data : [];
    if (gamesRaw.length === 0) {
      const boltOddsResult = await getBoltOddsNBAGamesToday(process.env.BOLTODDS_API_KEY);
      if (boltOddsResult.data.length > 0) {
        return {
          data: boltOddsResult.data,
          source: 'boltodds',
          warning: response.warning
            ? `${response.warning}. Fallback to BoltOdds`
            : 'Fallback to BoltOdds',
          errorCode: response.errorCode,
        };
      }

      return {
        data: [],
        source: response.source,
        warning: response.warning || boltOddsResult.warning || 'No games returned by providers',
        errorCode: response.errorCode || boltOddsResult.errorCode,
      };
    }

    const mapped = gamesRaw.map((game: any) => {
      const statusStr = String(game.status || '').toLowerCase();
      let status = 'scheduled';
      let GameStatus = 1;
      if (statusStr.includes('final')) {
        status = 'final';
        GameStatus = 3;
      } else if (statusStr.includes('q') || statusStr.includes('half')) {
        status = 'live';
        GameStatus = 2;
      }

      return {
        id: String(game.id || ''),
        gameId: String(game.id || ''),
        status,
        GameStatus,
        date: game.date || dateISO,
        gameTime: game.status || '',
        homeTeam: {
          id: String(game.home_team?.id || ''),
          abbreviation: game.home_team?.abbreviation || 'HOME',
          logoUrl: teamLogoUrl({ id: String(game.home_team?.id || ''), abbreviation: game.home_team?.abbreviation || 'HOME' }),
          name: game.home_team?.name || 'Home',
          city: game.home_team?.city || '',
        },
        awayTeam: {
          id: String(game.visitor_team?.id || ''),
          abbreviation: game.visitor_team?.abbreviation || 'AWAY',
          logoUrl: teamLogoUrl({ id: String(game.visitor_team?.id || ''), abbreviation: game.visitor_team?.abbreviation || 'AWAY' }),
          name: game.visitor_team?.name || 'Away',
          city: game.visitor_team?.city || '',
        },
        homeScore: toNumber(game.home_team_score),
        awayScore: toNumber(game.visitor_team_score),
      };
    });

    return { data: mapped, source: 'balldontlie', warning: response.warning };
  }

  async getInjuryListWithMeta(): Promise<ProviderResult<AnyRecord[]>> {
    const response = await requestBallDontLie<{ data: AnyRecord[] }>(
      '/players',
      { per_page: 100 },
      this.apiKey
    );
    const playersRaw = Array.isArray((response.data as any)?.data) ? (response.data as any).data : [];
    const injuries = playersRaw
      .filter((p: any) => p?.injury?.status)
      .map((p: any) => ({
        playerId: String(p.id || ''),
        playerName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        teamName: p.team?.name || 'Unknown',
        status: p.injury?.status || 'Unknown',
        injuryType: p.injury?.description || 'Unknown',
      }));

    const warning = injuries.length === 0
      ? (response.warning || 'BallDontLie returned no injury fields for players')
      : response.warning;
    return { data: injuries, source: response.source, warning, errorCode: response.errorCode };
  }

  async getPlayers(season?: string): Promise<Player[]> {
    return (await this.getPlayersWithMeta(season)).data;
  }

  async getPlayerByIdWithMeta(playerId: string, season?: string): Promise<ProviderResult<Player | null>> {
    await loadPersistedCache();
    const activeSeason = normalizeSeason(season);
    const numericId = toNumber(playerId);
    if (!numericId) {
      return {
        data: null,
        source: 'none',
        warning: 'Invalid player id',
        errorCode: 'UPSTREAM_BAD_RESPONSE',
      };
    }

    const playerResponse = await requestBallDontLie<{ data: AnyRecord }>(
      `/players/${numericId}`,
      {},
      this.apiKey
    );

    const playerRaw = (playerResponse.data as any)?.data;
    if (!playerRaw || typeof playerRaw !== 'object') {
      const activeCache = playersCacheBySeason.get(activeSeason)?.value || [];
      const cached = activeCache.find((p) => p.id === String(numericId));
      return {
        data: cached || null,
        source: cached ? 'balldontlie' : playerResponse.source,
        warning: cached
          ? (playerResponse.warning
              ? `${playerResponse.warning}. Using cached player detail`
              : 'Using cached player detail')
          : (playerResponse.warning || 'Player not found'),
        errorCode: playerResponse.errorCode,
      };
    }

    const averagesResult = await requestBallDontLie<{ data: AnyRecord[] }>(
      '/season_averages',
      { season: activeSeason, player_ids: [numericId] },
      this.apiKey
    );

    const seasonAvgByPlayerId = mapSeasonAverages(averagesResult.data);
    const mapped = mapPlayers([playerRaw], seasonAvgByPlayerId)[0] || null;
    if (!mapped) {
      return {
        data: null,
        source: playerResponse.source,
        warning: playerResponse.warning || averagesResult.warning || 'Player mapping failed',
        errorCode: playerResponse.errorCode || averagesResult.errorCode,
      };
    }

    const playersEntry = playersCacheBySeason.get(activeSeason);
    const players = playersEntry?.value || [];
    const merged = [...players.filter((p) => p.id !== mapped.id), mapped];
    playersCacheBySeason.set(activeSeason, {
      value: merged,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    void persistCache();

    return {
      data: mapped,
      source: 'balldontlie',
      warning: playerResponse.warning || averagesResult.warning,
      errorCode: playerResponse.errorCode || averagesResult.errorCode,
    };
  }

  async getTeams(season?: string): Promise<TeamWithStats[]> {
    void season;
    return (await this.getTeamsWithMeta()).data;
  }

  async getLeagueDashTeamStats(season?: string): Promise<TeamWithStats[]> {
    return this.getTeams(season);
  }

  async getTodaysGames(): Promise<AnyRecord[]> {
    return (await this.getTodaysGamesWithMeta()).data;
  }

  async getInjuryList(): Promise<AnyRecord[]> {
    return (await this.getInjuryListWithMeta()).data;
  }

  async getStandings(): Promise<AnyRecord[]> {
    return [];
  }

  async getBoxScoreTraditional(): Promise<AnyRecord[]> {
    return [];
  }

  async getBoxScoreAdvanced(): Promise<AnyRecord[]> {
    return [];
  }

  async getBoxScoreScoring(): Promise<AnyRecord[]> {
    return [];
  }
}

export function createNBAClient(_type: string, _apiKey?: string) {
  return new NBAStatsClient();
}
