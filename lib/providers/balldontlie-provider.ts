import { createNBAClient } from '@/lib/nba-api/client';
import type { DataProvider, GameDTO, PlayerStatsPayload, ProviderResponse } from '@/lib/providers/provider-types';
import type { Player, TeamWithStats } from '@/lib/types';

export class BallDontLieProvider implements DataProvider {
  private client = createNBAClient('nba');

  async getPlayers(season?: string): Promise<ProviderResponse<Player[]>> {
    const result = await this.client.getPlayersWithMeta(season);
    return { data: result.data, source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }

  async getPlayerById(playerId: string, season?: string): Promise<ProviderResponse<Player | null>> {
    const result = await this.client.getPlayerByIdWithMeta(playerId, season);
    return { data: result.data, source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }

  async getPlayerStats(playerId: string, season?: string): Promise<ProviderResponse<PlayerStatsPayload | null>> {
    const playerResult = await this.client.getPlayerByIdWithMeta(playerId, season);
    const player = playerResult.data;
    if (!player) {
      return {
        data: null,
        source: playerResult.source,
        warning: playerResult.warning || 'Player not found',
        errorCode: playerResult.errorCode as any,
      };
    }

    const last5 = player.last5Games || [];
    return {
      data: {
        season: player.seasonStats,
        last5,
        last10: last5,
        career: null,
        home: null,
        away: null,
        vsConference: null,
        vsDivision: null,
      },
      source: playerResult.source,
      warning: playerResult.warning,
      errorCode: playerResult.errorCode as any,
    };
  }

  async getGamesToday(dateISO?: string): Promise<ProviderResponse<GameDTO[]>> {
    const result = await this.client.getTodaysGamesWithMeta(dateISO);
    return { data: result.data as GameDTO[], source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }

  async getGameBoxscore(gameId: string): Promise<ProviderResponse<any>> {
    void gameId;
    return {
      data: null,
      source: 'none',
      warning: 'BallDontLie boxscore is not implemented in this project',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  async getTeams(season?: string): Promise<ProviderResponse<TeamWithStats[]>> {
    void season;
    const result = await this.client.getTeamsWithMeta();
    return { data: result.data, source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }

  async getTeamRoster(teamId: string, season?: string): Promise<ProviderResponse<Player[]>> {
    const result = await this.client.getPlayersWithMeta(season);
    const roster = result.data.filter((p) => p.team?.id === teamId);
    return { data: roster, source: result.source, warning: result.warning, errorCode: result.errorCode as any };
  }
}

