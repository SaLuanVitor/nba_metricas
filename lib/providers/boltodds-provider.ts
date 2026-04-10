import { getBoltOddsBoxScoreByGameKey, getBoltOddsNBAGamesToday } from '@/lib/odds-api/boltodds';
import type { DataProvider, GameDTO, PlayerStatsPayload, ProviderResponse } from '@/lib/providers/provider-types';
import type { Player, TeamWithStats } from '@/lib/types';

export class BoltOddsProvider implements DataProvider {
  async getPlayers(_season?: string): Promise<ProviderResponse<Player[]>> {
    return {
      data: [],
      source: 'none',
      warning: 'BoltOdds is not a primary players provider',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  async getPlayerById(_playerId: string, _season?: string): Promise<ProviderResponse<Player | null>> {
    return {
      data: null,
      source: 'none',
      warning: 'BoltOdds is not a primary player profile provider',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  async getPlayerStats(_playerId: string, _season?: string): Promise<ProviderResponse<PlayerStatsPayload | null>> {
    return {
      data: null,
      source: 'none',
      warning: 'BoltOdds is not a primary player stats provider',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  async getGamesToday(_dateISO?: string): Promise<ProviderResponse<GameDTO[]>> {
    const result = await getBoltOddsNBAGamesToday(process.env.BOLTODDS_API_KEY);
    return { data: result.data as GameDTO[], source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }

  async getGameBoxscore(gameId: string): Promise<ProviderResponse<any>> {
    const gamesResult = await getBoltOddsNBAGamesToday(process.env.BOLTODDS_API_KEY);
    const game = gamesResult.data.find((g: any) => g.id === gameId || g.gameId === gameId);
    if (!game?.boltOddsGameKey) {
      return {
        data: null,
        source: gamesResult.source,
        warning: gamesResult.warning || 'Game not found for BoltOdds boxscore',
        errorCode: gamesResult.errorCode as any,
      };
    }

    const boxResult = await getBoltOddsBoxScoreByGameKey(process.env.BOLTODDS_API_KEY, game.boltOddsGameKey);
    return { data: boxResult.data, source: boxResult.source, warning: boxResult.warning, errorCode: boxResult.errorCode as any };
  }

  async getTeams(_season?: string): Promise<ProviderResponse<TeamWithStats[]>> {
    return {
      data: [],
      source: 'none',
      warning: 'BoltOdds is not a primary teams provider',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  async getTeamRoster(_teamId: string, _season?: string): Promise<ProviderResponse<Player[]>> {
    return {
      data: [],
      source: 'none',
      warning: 'BoltOdds is not a primary team roster provider',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }
}
