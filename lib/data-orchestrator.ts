import { promises as fs } from 'fs';
import path from 'path';
import { BallDontLieProvider } from '@/lib/providers/balldontlie-provider';
import { BoltOddsProvider } from '@/lib/providers/boltodds-provider';
import { NBAStatsProvider } from '@/lib/providers/nba-stats-provider';
import type { GameDTO, PlayerStatsPayload, ProviderResponse, ProviderSource } from '@/lib/providers/provider-types';
import type { Player, TeamWithStats } from '@/lib/types';
import { getFreshOrLastGood, saveSnapshot, type SnapshotDomain } from '@/lib/cache/snapshot-store';
import { observeCacheDecision } from '@/lib/resilience/control';

type CacheStatus = 'fresh' | 'stale' | 'rejected';
type SourceHealth = 'ok' | 'degraded';

type CachedEntry = {
  payload: any;
  updatedAt: number;
};

type PersistedCache = {
  entries: Record<string, CachedEntry>;
};

type OrchestratedResponse<T> = ProviderResponse<T> & {
  sourceHealth: SourceHealth;
  cacheStatus: CacheStatus;
  statsCoverage?: number;
  activePlayersCount?: number;
};

const CACHE_FILE = path.join(process.cwd(), '.cache', 'data-orchestrator.json');
const CACHE_TTL_MS = 1000 * 60 * 30;
const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 30;
const TEAMS_CACHE_TTL_MS = 1000 * 60 * 60;
const GAMES_CACHE_TTL_MS = 1000 * 60 * 10;
const BOXSCORE_CACHE_TTL_MS = 1000 * 60 * 5;
const COOLDOWN_MS = 90_000;

class DataOrchestrator {
  private readonly nbaStats = new NBAStatsProvider();
  private readonly balldontlie = new BallDontLieProvider();
  private readonly boltodds = new BoltOddsProvider();
  private memoryCache = new Map<string, CachedEntry>();
  private cooldown = new Map<string, number>();
  private refreshInflight = new Map<string, Promise<void>>();
  private cacheLoaded = false;

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;
    try {
      const raw = await fs.readFile(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedCache;
      Object.entries(parsed.entries || {}).forEach(([k, v]) => this.memoryCache.set(k, v));
    } catch {
      // ignore when cache file doesn't exist
    }
  }

  private async persistCache(): Promise<void> {
    const entries: Record<string, CachedEntry> = {};
    for (const [k, v] of this.memoryCache.entries()) entries[k] = v;
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify({ entries }, null, 2), 'utf-8');
  }

  private getCached<T>(key: string): CachedEntry | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    return cached;
  }

  private async saveCached(key: string, payload: any): Promise<void> {
    this.memoryCache.set(key, { payload, updatedAt: Date.now() });
    try {
      await this.persistCache();
    } catch (error) {
      console.warn(`[CACHE_PERSIST_FAILED] key=${key}`, error);
    }
  }

  private sourceHealthFromSource(source: ProviderSource): SourceHealth {
    return source === 'none' ? 'degraded' : 'ok';
  }

  private inferSnapshotDomain(key: string): SnapshotDomain {
    if (key.startsWith('players:')) return 'players';
    if (key.startsWith('teams:')) return 'teams';
    if (key.startsWith('games-today:')) return 'games';
    if (key.startsWith('boxscore:')) return 'boxscore';
    if (key.startsWith('player-stats:')) return 'player-stats';
    if (key.startsWith('player:')) return 'player';
    if (key.startsWith('team-roster:')) return 'team-roster';
    return 'generic';
  }

  private async saveSnapshotFromResponse<T>(key: string, ttlMs: number, payload: OrchestratedResponse<T>): Promise<void> {
    const domain = this.inferSnapshotDomain(key);
    const keyParts = key.split(':');
    const season = keyParts.length > 1 ? keyParts[1] : undefined;
    const dateRef = domain === 'games' && keyParts.length > 1 ? keyParts[1] : undefined;
    const coverageRaw = typeof payload.statsCoverage === 'number'
      ? payload.statsCoverage
      : (typeof payload.activePlayersCount === 'number' && Array.isArray(payload.data) && payload.data.length > 0
          ? Number((payload.activePlayersCount / payload.data.length).toFixed(4))
          : undefined);

    await saveSnapshot({
      domain,
      cacheKey: key,
      payload,
      ttlMs,
      source: payload.source,
      sourceHealth: payload.sourceHealth ?? 'degraded',
      cacheStatus: payload.cacheStatus ?? 'rejected',
      errorCode: payload.errorCode,
      coverage: coverageRaw,
      season,
      dateRef,
      isGood: payload.source !== 'none' && payload.cacheStatus !== 'rejected',
    });
  }

  private triggerBackgroundRefresh<T>(
    key: string,
    fetchers: Array<() => Promise<ProviderResponse<T>>>,
    options: {
      validate?: (data: T) => boolean;
      enrich?: (resp: ProviderResponse<T>) => Partial<OrchestratedResponse<T>>;
      ttlMs?: number;
    }
  ): void {
    if (this.refreshInflight.has(key)) return;
    const task = (async () => {
      try {
        await this.fetchAndPersist(key, fetchers, options);
      } catch (error) {
        console.warn(`[BACKGROUND_REFRESH_FAILED] key=${key}`, error);
      } finally {
        this.refreshInflight.delete(key);
      }
    })();
    this.refreshInflight.set(key, task);
  }

  private async fetchAndPersist<T>(
    key: string,
    fetchers: Array<() => Promise<ProviderResponse<T>>>,
    options: {
      validate?: (data: T) => boolean;
      enrich?: (resp: ProviderResponse<T>) => Partial<OrchestratedResponse<T>>;
      ttlMs?: number;
    }
  ): Promise<OrchestratedResponse<T>> {
    const ttlMs = options?.ttlMs ?? CACHE_TTL_MS;
    const cached = this.getCached<T>(key);
    let lastFailure: ProviderResponse<T> | null = null;

    for (let index = 0; index < fetchers.length; index += 1) {
      const fetcher = fetchers[index];
      let result: ProviderResponse<T>;
      try {
        result = await fetcher();
      } catch (error: any) {
        console.error(`[PROVIDER_FETCH_THROWN] key=${key} attempt=${index + 1}`, error);
        result = {
          data: (Array.isArray(cached?.payload?.data) ? [] : (null as any)) as T,
          source: 'none',
          warning: `Provider execution failed (${error?.message || 'unknown error'})`,
          errorCode: 'UPSTREAM_BAD_RESPONSE',
        };
      }

      const hasValidData = options?.validate
        ? options.validate(result.data)
        : Boolean(result.data && (Array.isArray(result.data) ? result.data.length : true));

      if (hasValidData) {
        if (index > 0) {
          console.warn(`[PROVIDER_FALLBACK_USED] key=${key} source=${result.source} fallbackIndex=${index}`);
        }
        const out: OrchestratedResponse<T> = {
          ...result,
          sourceHealth: this.sourceHealthFromSource(result.source),
          cacheStatus: 'fresh',
          ...(options?.enrich ? options.enrich(result) : {}),
        };
        await this.saveCached(key, out);
        await this.saveSnapshotFromResponse(key, ttlMs, out);
        observeCacheDecision(this.inferSnapshotDomain(key), 'upstream');
        return out;
      }

      lastFailure = result;
      if (result.errorCode === 'UPSTREAM_RATE_LIMIT') {
        console.warn(`[UPSTREAM_RATE_LIMIT] key=${key} source=${result.source} attempt=${index + 1}`);
        this.setCooldown(key);
      }
    }

    if (cached) {
      console.warn(`[CACHE_STALE_SERVED] key=${key} reason=all_providers_failed`);
      const stale = {
        ...(cached.payload as OrchestratedResponse<T>),
        cacheStatus: 'stale' as CacheStatus,
        sourceHealth: 'degraded' as SourceHealth,
        warning: lastFailure?.warning || 'Providers unavailable; serving stale snapshot',
        errorCode: lastFailure?.errorCode,
      };
      observeCacheDecision(this.inferSnapshotDomain(key), 'memory_stale');
      return stale;
    }

    observeCacheDecision(this.inferSnapshotDomain(key), 'rejected');
    return {
      data: (Array.isArray(lastFailure?.data) ? [] : (null as any)) as T,
      source: 'none',
      warning: lastFailure?.warning || 'Providers unavailable',
      errorCode: lastFailure?.errorCode,
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      ...(options?.enrich ? options.enrich(lastFailure as ProviderResponse<T>) : {}),
    };
  }

  private playersCoverage(players: Player[]): number {
    if (!players.length) return 0;
    const nonZero = players.filter((p) => (p.seasonStats.points || 0) > 0 || (p.seasonStats.minutes || 0) > 0).length;
    return Number((nonZero / players.length).toFixed(4));
  }

  private inCooldown(key: string): boolean {
    const until = this.cooldown.get(key) || 0;
    return Date.now() < until;
  }

  private setCooldown(key: string): void {
    this.cooldown.set(key, Date.now() + COOLDOWN_MS);
  }

  private async runWithFallbacks<T>(
    key: string,
    fetchers: Array<() => Promise<ProviderResponse<T>>>,
    options?: {
      allowBoltOdds?: boolean;
      validate?: (data: T) => boolean;
      enrich?: (resp: ProviderResponse<T>) => Partial<OrchestratedResponse<T>>;
      ttlMs?: number;
      forceRefresh?: boolean;
    }
  ): Promise<OrchestratedResponse<T>> {
    await this.ensureCacheLoaded();
    const cached = this.getCached(key);
    const ttlMs = options?.ttlMs ?? CACHE_TTL_MS;
    const forceRefresh = options?.forceRefresh ?? false;
    const cacheFresh = cached ? Date.now() - cached.updatedAt < ttlMs : false;
    const domain = this.inferSnapshotDomain(key);

    if (cacheFresh && !forceRefresh) {
      observeCacheDecision(domain, 'memory_fresh');
      return {
        ...(cached!.payload as OrchestratedResponse<T>),
        cacheStatus: 'fresh',
      };
    }
    if (forceRefresh) {
      console.info(`[MATCHUP_CACHE_BYPASSED] key=${key}`);
    }

    if (!forceRefresh && this.inCooldown(key) && cached) {
      console.warn(`[CACHE_STALE_SERVED] key=${key} reason=cooldown`);
      observeCacheDecision(domain, 'memory_stale');
      return {
        ...(cached.payload as OrchestratedResponse<T>),
        cacheStatus: 'stale',
        sourceHealth: 'degraded',
        warning: 'Cooldown active after upstream errors. Serving stale snapshot',
      };
    }

    if (!forceRefresh) {
      const persisted = await getFreshOrLastGood(domain, key);
      if (persisted.status !== 'none') {
        const snapshotPayload = persisted.snapshot.payload as OrchestratedResponse<T>;
        const snapshotAge = Date.now() - new Date(persisted.snapshot.capturedAt).getTime();
        const isSnapshotFresh = persisted.status === 'fresh' && snapshotAge < ttlMs;
        await this.saveCached(key, snapshotPayload);
        observeCacheDecision(domain, persisted.status === 'fresh' ? 'snapshot_fresh' : 'snapshot_last_good');

        this.triggerBackgroundRefresh<T>(key, fetchers, {
          validate: options?.validate,
          enrich: options?.enrich,
          ttlMs,
        });

        return {
          ...snapshotPayload,
          cacheStatus: isSnapshotFresh ? 'fresh' : 'stale',
          sourceHealth: persisted.status === 'last_good' ? 'degraded' : (snapshotPayload.sourceHealth ?? 'degraded'),
          warning: persisted.status === 'last_good'
            ? (snapshotPayload.warning || 'Serving last good snapshot while providers recover')
            : snapshotPayload.warning,
        };
      }

      if (cached) {
        observeCacheDecision(domain, 'memory_stale');
        this.triggerBackgroundRefresh<T>(key, fetchers, {
          validate: options?.validate,
          enrich: options?.enrich,
          ttlMs,
        });
        return {
          ...(cached.payload as OrchestratedResponse<T>),
          cacheStatus: 'stale',
          sourceHealth: 'degraded',
          warning: 'Serving stale cache while refreshing in background',
        };
      }
    }

    return this.fetchAndPersist<T>(key, fetchers, {
      validate: options?.validate,
      enrich: options?.enrich,
      ttlMs,
    });
  }

  async getPlayers(season?: string, options?: { forceRefresh?: boolean }): Promise<OrchestratedResponse<Player[]>> {
    return this.runWithFallbacks<Player[]>(
      `players:${season || 'current'}`,
      [
        () => this.nbaStats.getPlayers(season),
        () => this.balldontlie.getPlayers(season),
      ],
      {
        validate: (data) => Array.isArray(data) && data.length > 0,
        ttlMs: PLAYERS_CACHE_TTL_MS,
        enrich: (resp) => {
          const players = Array.isArray(resp.data) ? resp.data : [];
          return {
            statsCoverage: this.playersCoverage(players),
            activePlayersCount: players.length,
          };
        },
        forceRefresh: options?.forceRefresh,
      }
    );
  }

  async getPlayerById(playerId: string, season?: string): Promise<OrchestratedResponse<Player | null>> {
    const key = `player:${season || 'current'}:${playerId}`;
    return this.runWithFallbacks<Player | null>(
      key,
      [
        () => this.nbaStats.getPlayerById(playerId, season),
        () => this.balldontlie.getPlayerById(playerId, season),
      ],
      { validate: (data) => Boolean(data) }
    );
  }

  async getPlayerStats(playerId: string, season?: string): Promise<OrchestratedResponse<PlayerStatsPayload | null>> {
    const key = `player-stats:${season || 'current'}:${playerId}`;
    return this.runWithFallbacks<PlayerStatsPayload | null>(
      key,
      [
        () => this.nbaStats.getPlayerStats(playerId, season),
        () => this.balldontlie.getPlayerStats(playerId, season),
      ],
      { validate: (data) => Boolean(data) }
    );
  }

  async getGamesToday(dateISO?: string, options?: { forceRefresh?: boolean }): Promise<OrchestratedResponse<GameDTO[]>> {
    return this.runWithFallbacks<GameDTO[]>(
      `games-today:${dateISO || 'today'}`,
      [
        () => this.nbaStats.getGamesToday(dateISO),
        () => this.balldontlie.getGamesToday(dateISO),
        () => this.boltodds.getGamesToday(dateISO),
      ],
      {
        validate: (data) => Array.isArray(data) && data.length > 0,
        ttlMs: GAMES_CACHE_TTL_MS,
        forceRefresh: options?.forceRefresh,
      }
    );
  }

  async getGameBoxscore(gameId: string): Promise<OrchestratedResponse<any>> {
    return this.runWithFallbacks<any>(
      `boxscore:${gameId}`,
      [
        () => this.nbaStats.getGameBoxscore(gameId),
        () => this.boltodds.getGameBoxscore(gameId),
      ],
      {
        validate: (data) => Boolean(data),
        ttlMs: BOXSCORE_CACHE_TTL_MS,
      }
    );
  }

  async getTeams(season?: string, options?: { forceRefresh?: boolean }): Promise<OrchestratedResponse<TeamWithStats[]>> {
    return this.runWithFallbacks<TeamWithStats[]>(
      `teams:${season || 'current'}`,
      [
        () => this.nbaStats.getTeams(season),
        () => this.balldontlie.getTeams(season),
      ],
      {
        validate: (data) => Array.isArray(data) && data.length > 0,
        ttlMs: TEAMS_CACHE_TTL_MS,
        forceRefresh: options?.forceRefresh,
      }
    );
  }

  async getTeamRoster(teamId: string, season?: string, options?: { forceRefresh?: boolean }): Promise<OrchestratedResponse<Player[]>> {
    return this.runWithFallbacks<Player[]>(
      `team-roster:${season || 'current'}:${teamId}`,
      [
        () => this.nbaStats.getTeamRoster(teamId, season),
        () => this.balldontlie.getTeamRoster(teamId, season),
      ],
      {
        validate: (data) => Array.isArray(data) && data.length > 0,
        forceRefresh: options?.forceRefresh,
      }
    );
  }
}

const orchestrator = new DataOrchestrator();
export function getDataOrchestrator() {
  return orchestrator;
}
