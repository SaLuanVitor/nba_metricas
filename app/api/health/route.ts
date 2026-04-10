import { NextResponse } from 'next/server';
import { getPgHealth } from '@/lib/db/pg';

export async function GET() {
  const hasNBAStats = Boolean(process.env.NBA_STATS_BASE_URL || process.env.NBA_STATS_USER_AGENT || process.env.NBA_STATS_REFERER);
  const hasBallDontLie = Boolean(process.env.BALLDONTLIE_API_KEY);
  const hasBoltOdds = Boolean(process.env.BOLTODDS_API_KEY);
  const dbHealth = await getPgHealth();
  const hasAiChat = true;
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';

  const providerStatus = {
    'nba-stats': hasNBAStats ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    balldontlie: hasBallDontLie ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    boltodds: hasBoltOdds ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    database: dbHealth === 'configured' ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
    'ai-chat': hasAiChat ? 'configured' : (isDev ? 'degraded' : 'unavailable'),
  };

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
    environment: process.env.NODE_ENV || 'development',
  });
}
