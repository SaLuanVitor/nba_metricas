import { NextResponse } from 'next/server';
import { getPgHealth } from '@/lib/db/pg';
import { getResilienceSnapshot } from '@/lib/resilience/control';
import { getSnapshotMetrics } from '@/lib/cache/snapshot-store';

export async function GET() {
  const hasNBAStats = Boolean(process.env.NBA_STATS_BASE_URL || process.env.NBA_STATS_USER_AGENT || process.env.NBA_STATS_REFERER);
  const hasBallDontLie = Boolean(process.env.BALLDONTLIE_API_KEY);
  const hasBoltOdds = Boolean(process.env.BOLTODDS_API_KEY);
  const dbHealth = await getPgHealth();
  const hasAiChat = true;
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const hasMasterBootstrap = Boolean(process.env.MASTER_EMAIL && process.env.MASTER_PASSWORD);
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const resilience = getResilienceSnapshot();
  const snapshotMetrics = await getSnapshotMetrics();

  const providerStatus = {
    'nba-stats': hasNBAStats ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    balldontlie: hasBallDontLie ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    boltodds: hasBoltOdds ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    'odds-market': hasBoltOdds ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    database: dbHealth === 'configured' ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    auth: hasAuthSecret && hasMasterBootstrap ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    'ai-chat': hasAiChat ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
  };

  const missingRequiredEnv = [
    !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET ? 'AUTH_SECRET' : null,
    !process.env.MASTER_EMAIL ? 'MASTER_EMAIL' : null,
    !process.env.MASTER_PASSWORD ? 'MASTER_PASSWORD' : null,
    !process.env.DATABASE_URL ? 'DATABASE_URL' : null,
    !process.env.BALLDONTLIE_API_KEY ? 'BALLDONTLIE_API_KEY' : null,
  ].filter(Boolean) as string[];

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    providers: providerStatus,
    services: {
      database: dbHealth === 'configured' ? 'ok' : 'degraded',
      cache: 'ok',
      externalApi: hasNBAStats || hasBallDontLie || hasBoltOdds ? 'ok' : 'degraded',
      providers: providerStatus,
    },
    missingRequiredEnv,
    deploymentHints: {
      platform: process.env.RAILWAY_ENVIRONMENT ? 'railway' : 'generic',
      hasRailwayEnv: Boolean(process.env.RAILWAY_ENVIRONMENT),
    },
    environment: process.env.NODE_ENV || 'development',
    cacheMetrics: snapshotMetrics,
    circuitBreaker: resilience.breaker,
    rateBudget: resilience.budgets,
    telemetry: {
      counters: resilience.counters,
      latency: resilience.latencySummary,
    },
  });
}
