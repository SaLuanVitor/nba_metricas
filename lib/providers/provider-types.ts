import type { Player, TeamWithStats } from '@/lib/types';

export type UpstreamErrorCode =
  | 'UPSTREAM_UNAUTHORIZED'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_BAD_RESPONSE';

export type ProviderSource = 'nba-stats' | 'balldontlie' | 'boltodds' | 'none';

export type ProviderResponse<T> = {
  data: T;
  source: ProviderSource;
  warning?: string;
  errorCode?: UpstreamErrorCode;
};

export type GameDTO = {
  id: string;
  gameId: string;
  status: 'scheduled' | 'live' | 'final';
  GameStatus: 1 | 2 | 3;
  date: string;
  gameTime: string;
  watchUrl?: string;
  homeTeam: { id: string; abbreviation: string; name: string; city: string; logoUrl?: string };
  awayTeam: { id: string; abbreviation: string; name: string; city: string; logoUrl?: string };
  homeScore: number;
  awayScore: number;
  boltOddsGameKey?: string;
};

export type PlayerStatsPayload = {
  season: any;
  last5: any[];
  last10: any[];
  career: any;
  home: any;
  away: any;
  vsConference: any;
  vsDivision: any;
};

export interface DataProvider {
  getPlayers(season?: string): Promise<ProviderResponse<Player[]>>;
  getPlayerById(playerId: string, season?: string): Promise<ProviderResponse<Player | null>>;
  getPlayerStats(playerId: string, season?: string): Promise<ProviderResponse<PlayerStatsPayload | null>>;
  getGamesToday(dateISO?: string): Promise<ProviderResponse<GameDTO[]>>;
  getGameBoxscore(gameId: string): Promise<ProviderResponse<any>>;
  getTeams(season?: string): Promise<ProviderResponse<TeamWithStats[]>>;
  getTeamRoster(teamId: string, season?: string): Promise<ProviderResponse<Player[]>>;
}
