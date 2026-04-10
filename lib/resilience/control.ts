import type { UpstreamErrorCode } from '@/lib/providers/provider-types';

type ProviderName = 'nba-stats' | 'balldontlie' | 'boltodds';
type BreakerState = 'closed' | 'open' | 'half_open';

type BreakerEntry = {
  state: BreakerState;
  failures: number;
  openCount: number;
  openedUntil: number;
  halfOpenProbeInFlight: boolean;
  lastErrorCode?: UpstreamErrorCode;
};

type BucketEntry = {
  tokens: number;
  updatedAt: number;
};

const breakerByKey = new Map<string, BreakerEntry>();
const bucketByProvider = new Map<ProviderName, BucketEntry>();
const counters = new Map<string, number>();
const latencies = new Map<string, number[]>();

const BREAKER_FAILURE_THRESHOLD = Math.max(2, Number(process.env.RESILIENCE_BREAKER_FAILURE_THRESHOLD || 3));
const BREAKER_BASE_COOLDOWN_MS = Math.max(15_000, Number(process.env.RESILIENCE_BREAKER_BASE_COOLDOWN_MS || 60_000));
const BREAKER_MAX_COOLDOWN_MS = Math.max(BREAKER_BASE_COOLDOWN_MS, Number(process.env.RESILIENCE_BREAKER_MAX_COOLDOWN_MS || 900_000));
const LATENCY_SAMPLE_LIMIT = 200;

const TOKEN_PER_MIN: Record<ProviderName, number> = {
  'nba-stats': Math.max(20, Number(process.env.RESILIENCE_BUDGET_NBA_STATS_PER_MIN || 120)),
  balldontlie: Math.max(10, Number(process.env.RESILIENCE_BUDGET_BALLDONTLIE_PER_MIN || 60)),
  boltodds: Math.max(10, Number(process.env.RESILIENCE_BUDGET_BOLTODDS_PER_MIN || 60)),
};

const COST_BY_ENDPOINT: Record<string, number> = {
  season_averages: 3,
  players: 2,
  teams: 1,
  games: 1,
};

function key(provider: ProviderName, endpoint: string): string {
  return `${provider}:${endpoint}`;
}

function getBreaker(provider: ProviderName, endpoint: string): BreakerEntry {
  const k = key(provider, endpoint);
  const existing = breakerByKey.get(k);
  if (existing) return existing;
  const entry: BreakerEntry = { state: 'closed', failures: 0, openCount: 0, openedUntil: 0, halfOpenProbeInFlight: false };
  breakerByKey.set(k, entry);
  return entry;
}

function getCost(endpoint: string): number {
  const normalized = endpoint.replace(/^\//, '').toLowerCase();
  return COST_BY_ENDPOINT[normalized] || 1;
}

function recordCounter(name: string, labels?: Record<string, string | number | boolean>): void {
  const suffix = labels
    ? ':' + Object.entries(labels).map(([k, v]) => `${k}=${String(v)}`).join(',')
    : '';
  const k = `${name}${suffix}`;
  counters.set(k, (counters.get(k) || 0) + 1);
}

export function recordLatency(metric: string, ms: number): void {
  const arr = latencies.get(metric) || [];
  arr.push(Number(ms));
  if (arr.length > LATENCY_SAMPLE_LIMIT) arr.shift();
  latencies.set(metric, arr);
}

export function observeCacheDecision(domain: string, decision: 'memory_fresh' | 'memory_stale' | 'snapshot_fresh' | 'snapshot_last_good' | 'upstream' | 'rejected') {
  recordCounter('snapshot_served_total', { domain, decision });
}

export function observeUpstreamCall(provider: ProviderName, endpoint: string) {
  recordCounter('upstream_calls_total', { provider, endpoint });
}

export function observeUpstreamError(provider: ProviderName, endpoint: string, errorCode?: UpstreamErrorCode) {
  if (!errorCode) return;
  if (errorCode === 'UPSTREAM_RATE_LIMIT') recordCounter('rate_limit_total', { provider, endpoint });
  if (errorCode === 'UPSTREAM_UNAUTHORIZED') recordCounter('auth_fail_total', { provider, endpoint });
}

export function consumeBudget(provider: ProviderName, endpoint: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const capacity = TOKEN_PER_MIN[provider];
  const refillPerMs = capacity / 60_000;
  const cost = getCost(endpoint);
  const bucket = bucketByProvider.get(provider) || { tokens: capacity, updatedAt: now };
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;
  if (bucket.tokens < cost) {
    bucketByProvider.set(provider, bucket);
    recordCounter('budget_block_total', { provider, endpoint });
    return { allowed: false, remaining: Number(bucket.tokens.toFixed(2)) };
  }
  bucket.tokens -= cost;
  bucketByProvider.set(provider, bucket);
  return { allowed: true, remaining: Number(bucket.tokens.toFixed(2)) };
}

export function canAttempt(provider: ProviderName, endpoint: string): { allowed: boolean; state: BreakerState; reason?: string } {
  const breaker = getBreaker(provider, endpoint);
  const now = Date.now();
  if (breaker.state === 'open') {
    if (now < breaker.openedUntil) {
      return { allowed: false, state: 'open', reason: 'cooldown' };
    }
    breaker.state = 'half_open';
    breaker.halfOpenProbeInFlight = false;
  }

  if (breaker.state === 'half_open') {
    if (breaker.halfOpenProbeInFlight) {
      return { allowed: false, state: 'half_open', reason: 'probe_in_flight' };
    }
    breaker.halfOpenProbeInFlight = true;
    return { allowed: true, state: 'half_open' };
  }

  return { allowed: true, state: breaker.state };
}

export function recordSuccess(provider: ProviderName, endpoint: string): void {
  const breaker = getBreaker(provider, endpoint);
  breaker.state = 'closed';
  breaker.failures = 0;
  breaker.halfOpenProbeInFlight = false;
}

function shouldOpenOnError(code?: UpstreamErrorCode): boolean {
  return code === 'UPSTREAM_RATE_LIMIT' || code === 'UPSTREAM_UNAUTHORIZED' || code === 'UPSTREAM_UNAVAILABLE' || code === 'UPSTREAM_TIMEOUT';
}

export function recordFailure(provider: ProviderName, endpoint: string, code?: UpstreamErrorCode): void {
  const breaker = getBreaker(provider, endpoint);
  breaker.lastErrorCode = code;
  breaker.halfOpenProbeInFlight = false;
  if (!shouldOpenOnError(code)) return;
  breaker.failures += 1;
  if (breaker.failures < BREAKER_FAILURE_THRESHOLD) return;
  breaker.state = 'open';
  breaker.openCount += 1;
  const cooldown = Math.min(BREAKER_MAX_COOLDOWN_MS, BREAKER_BASE_COOLDOWN_MS * Math.pow(2, Math.max(0, breaker.openCount - 1)));
  breaker.openedUntil = Date.now() + cooldown;
  breaker.failures = 0;
  recordCounter('circuit_open_total', { provider, endpoint, code: code || 'unknown' });
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Number(sorted[index].toFixed(2));
}

export function getResilienceSnapshot() {
  const breaker: Record<string, any> = {};
  for (const [k, v] of breakerByKey.entries()) {
    breaker[k] = {
      state: v.state,
      openUntil: v.openedUntil ? new Date(v.openedUntil).toISOString() : null,
      openCount: v.openCount,
      lastErrorCode: v.lastErrorCode || null,
    };
  }

  const budgets: Record<string, any> = {};
  const now = Date.now();
  (Object.keys(TOKEN_PER_MIN) as ProviderName[]).forEach((provider) => {
    const capacity = TOKEN_PER_MIN[provider];
    const refillPerMs = capacity / 60_000;
    const bucket = bucketByProvider.get(provider) || { tokens: capacity, updatedAt: now };
    const elapsed = Math.max(0, now - bucket.updatedAt);
    const tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
    budgets[provider] = { remaining: Number(tokens.toFixed(2)), capacityPerMin: capacity };
  });

  const latencySummary: Record<string, { p50: number; p95: number; samples: number }> = {};
  for (const [k, values] of latencies.entries()) {
    latencySummary[k] = {
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      samples: values.length,
    };
  }

  return {
    counters: Object.fromEntries(counters.entries()),
    breaker,
    budgets,
    latencySummary,
  };
}

