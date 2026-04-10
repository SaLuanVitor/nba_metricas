import { NextResponse } from 'next/server';
import { createNBAClient } from '@/lib/nba-api/client';
import { collectBoltOddsMarketSnapshots } from '@/lib/odds/boltodds-collector';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type = 'all' } = body;

    const apiKey = process.env.BALLDONTLIE_API_KEY;
    const client = createNBAClient('aggregator', apiKey);

    console.log('=== SYNC API ===');
    console.log('Type:', type);

    switch (type) {
      case 'players':
        await syncPlayers(client);
        break;
      case 'teams':
        await syncTeams(client);
        break;
      case 'games':
        await syncGames(client);
        break;
      case 'odds':
        await syncOdds();
        break;
      case 'all':
      default:
        await syncPlayers(client);
        await syncTeams(client);
        await syncGames(client);
        await syncOdds();
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed for: ${type}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function syncPlayers(client: any) {
  console.log('Syncing players...');
  
  try {
    const players = await client.getPlayers('2024-25');
    console.log(`Fetched ${players.length} players`);
    
    if (players.length === 0) {
      throw new Error('No players returned from API');
    }
  } catch (error: any) {
    console.error('Players sync failed:', error.message);
    throw new Error(`Players API failed: ${error.message}`);
  }
}

async function syncTeams(client: any) {
  console.log('Syncing teams...');
  
  try {
    const teams = await client.getTeams();
    console.log(`Fetched ${teams.length} teams`);
    
    if (teams.length === 0) {
      throw new Error('No teams returned from API');
    }
  } catch (error: any) {
    console.error('Teams sync failed:', error.message);
    throw new Error(`Teams API failed: ${error.message}`);
  }
}

async function syncGames(client: any) {
  console.log('Syncing games...');
  
  try {
    const todayGames = await client.getTodaysGames();
    console.log(`Fetched ${todayGames.length} games for today`);
  } catch (error: any) {
    console.error('Games sync failed:', error.message);
    throw new Error(`Games API failed: ${error.message}`);
  }
}

async function syncOdds() {
  console.log('Syncing odds snapshots...');
  const result = await collectBoltOddsMarketSnapshots({
    apiKey: process.env.BOLTODDS_API_KEY,
    sports: ['NBA'],
    durationSec: 20,
    maxMessages: 600,
  });
  console.log(`Captured odds snapshots: inserted=${result.inserted}, total=${result.totalSnapshots}, parsed=${result.parsedMarkets}`);
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger sync',
    availableTypes: ['players', 'teams', 'games', 'odds', 'all'],
    example: {
      type: 'POST',
      body: JSON.stringify({ type: 'all' }),
    },
  });
}
