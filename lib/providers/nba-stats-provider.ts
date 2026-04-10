import { generateProjection } from '@/lib/ai/engine';
import type { DataProvider, GameDTO, PlayerStatsPayload, ProviderResponse, UpstreamErrorCode } from '@/lib/providers/provider-types';
import type { Player, PlayerStats, TeamWithStats } from '@/lib/types';

type AnyRecord = Record<string, any>;
type ResultSet = { name?: string; headers?: string[]; rowSet?: any[] };

const DEFAULT_BASE_URL = 'https://stats.nba.com/stats';
const DEFAULT_TIMEOUT_MS = 10000;
const SOURCE_TIMEZONE = 'America/New_York';

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapPosition(raw?: string): Player['position'] {
  const pos = String(raw || '').toUpperCase();
  if (pos.includes('PG')) return 'PG';
  if (pos.includes('SG')) return 'SG';
  if (pos.includes('SF')) return 'SF';
  if (pos.includes('PF')) return 'PF';
  if (pos.includes('C')) return 'C';
  return 'SG';
}

function getTeamColors(abbreviation: string) {
  const palette = ['#1D428A', '#C8102E', '#007A33', '#FDB927', '#006BB6', '#98002E', '#0E2240', '#5A2D81'];
  const hash = abbreviation.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const primaryColor = palette[hash % palette.length];
  const secondaryColor = palette[(hash + 3) % palette.length];
  return { primaryColor, secondaryColor };
}

function classifyStatus(status?: number): UpstreamErrorCode {
  if (status === 401 || status === 403) return 'UPSTREAM_UNAUTHORIZED';
  if (status === 429) return 'UPSTREAM_RATE_LIMIT';
  if (status && status >= 500) return 'UPSTREAM_UNAVAILABLE';
  return 'UPSTREAM_BAD_RESPONSE';
}

function seasonStartFromParam(season?: string): number {
  if (!season) {
    const now = new Date();
    const y = now.getUTCFullYear();
    return now.getUTCMonth() + 1 >= 9 ? y : y - 1;
  }
  const parsed = Number(String(season).slice(0, 4));
  return Number.isFinite(parsed) ? parsed : seasonStartFromParam(undefined);
}

function normalizeSeason(season?: string): string {
  if (season && /^\d{4}-\d{2}$/.test(season)) return season;
  const start = seasonStartFromParam(season);
  const end = String((start + 1) % 100).padStart(2, '0');
  return `${start}-${end}`;
}

function todayForScoreboard(dateISO?: string): string {
  const d = dateISO ? new Date(dateISO) : new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function getOffsetMsForTimezone(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - date.getTime();
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getOffsetMsForTimezone(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function toLocal24hFromEt(gameDateRaw: string, gameStatusText: string, targetTimeZone: string): string {
  const match = gameStatusText.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s*ET/i);
  if (!match) return gameStatusText;

  const dateMatch = String(gameDateRaw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return gameStatusText;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();

  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  const utcDate = zonedLocalToUtc(year, month, day, hour, minute, SOURCE_TIMEZONE);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: targetTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(utcDate);
}

function findResultSet(payload: AnyRecord, candidates: string[]): ResultSet | null {
  const sets: ResultSet[] = [];
  if (Array.isArray(payload?.resultSets)) sets.push(...payload.resultSets);
  if (payload?.resultSet) sets.push(payload.resultSet);
  const normalized = candidates.map((c) => c.toLowerCase());
  for (const rs of sets) {
    const rsName = String(rs?.name || '').toLowerCase();
    if (normalized.some((n) => rsName === n || rsName.includes(n))) return rs;
  }
  return sets[0] || null;
}

function rowsFromResultSet(rs: ResultSet | null): AnyRecord[] {
  if (!rs) return [];
  const headers = Array.isArray(rs.headers) ? rs.headers : [];
  const rows = Array.isArray(rs.rowSet) ? rs.rowSet : [];
  return rows.map((row) => {
    const out: AnyRecord = {};
    headers.forEach((h, idx) => {
      out[h] = row[idx];
    });
    return out;
  });
}

export class NBAStatsProvider implements DataProvider {
  private readonly baseUrl = process.env.NBA_STATS_BASE_URL || DEFAULT_BASE_URL;
  private readonly timeoutMs = toNumber(process.env.NBA_STATS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  private readonly userAgent =
    process.env.NBA_STATS_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  private readonly referer = process.env.NBA_STATS_REFERER || 'https://www.nba.com/';
  private readonly appTimezone = process.env.APP_TIMEZONE || 'America/Bahia';

  private async request(endpoint: string, params: Record<string, string | number>): Promise<ProviderResponse<AnyRecord>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.set(k, String(v)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}?${query.toString()}`, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Origin: 'https://www.nba.com',
          Referer: this.referer,
          'User-Agent': this.userAgent,
          'x-nba-stats-origin': 'stats',
          'x-nba-stats-token': 'true',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          data: {},
          source: 'none',
          warning: `NBA Stats unavailable (status ${response.status})`,
          errorCode: classifyStatus(response.status),
        };
      }
      const json = await response.json();
      return { data: json, source: 'nba-stats' };
    } catch (error: any) {
      return {
        data: {},
        source: 'none',
        warning: `NBA Stats unavailable (${error?.name === 'AbortError' ? 'timeout' : (error?.message || 'network error')})`,
        errorCode: error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_BAD_RESPONSE',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getPlayers(season?: string): Promise<ProviderResponse<Player[]>> {
    const normalizedSeason = normalizeSeason(season);
    const [playersRawResult, seasonStatsResult] = await Promise.all([
      this.request('commonallplayers', {
        IsOnlyCurrentSeason: 1,
        LeagueID: '00',
        Season: normalizedSeason,
      }),
      this.request('leaguedashplayerstats', {
        College: '',
        Conference: '',
        Country: '',
        DateFrom: '',
        DateTo: '',
        Division: '',
        DraftPick: '',
        DraftYear: '',
        GameScope: '',
        GameSegment: '',
        Height: '',
        LastNGames: 0,
        LeagueID: '00',
        Location: '',
        MeasureType: 'Base',
        Month: 0,
        OpponentTeamID: 0,
        Outcome: '',
        PORound: 0,
        PaceAdjust: 'N',
        PerMode: 'PerGame',
        Period: 0,
        PlayerExperience: '',
        PlayerPosition: '',
        PlusMinus: 'N',
        Rank: 'N',
        Season: normalizedSeason,
        SeasonSegment: '',
        SeasonType: 'Regular Season',
        ShotClockRange: '',
        StarterBench: '',
        TeamID: 0,
        TwoWay: 0,
        VsConference: '',
        VsDivision: '',
        Weight: '',
      }),
    ]);

    const baseRows = rowsFromResultSet(findResultSet(playersRawResult.data, ['commonallplayers']));
    const statsRows = rowsFromResultSet(findResultSet(seasonStatsResult.data, ['leaguedashplayerstats']));
    const statsById = new Map<number, AnyRecord>();
    for (const row of statsRows) {
      const id = toNumber(row.PLAYER_ID);
      if (id > 0) statsById.set(id, row);
    }

    const players: Player[] = baseRows
      .map((row) => {
        const idNum = toNumber(row.PERSON_ID || row.PLAYER_ID);
        if (!idNum) return null;
        const stats = statsById.get(idNum);
        if (!stats) return null;

        const abbreviation = String(stats.TEAM_ABBREVIATION || row.TEAM_ABBREVIATION || 'NBA');
        const colors = getTeamColors(abbreviation);
        const seasonStats: PlayerStats = {
          points: toNumber(stats.PTS),
          assists: toNumber(stats.AST),
          rebounds: toNumber(stats.REB),
          minutes: toNumber(stats.MIN),
          fieldGoalPercentage: toNumber(stats.FG_PCT) * 100,
          threePointPercentage: toNumber(stats.FG3_PCT) * 100,
          freeThrowPercentage: toNumber(stats.FT_PCT) * 100,
          steals: toNumber(stats.STL),
          blocks: toNumber(stats.BLK),
          turnovers: toNumber(stats.TOV),
        };

        const firstName = String(row.DISPLAY_FIRST_LAST || stats.PLAYER_NAME || '').split(' ').slice(0, -1).join(' ').trim();
        const lastName = String(row.DISPLAY_FIRST_LAST || stats.PLAYER_NAME || '').split(' ').slice(-1).join(' ').trim();
        const fullName = String(stats.PLAYER_NAME || row.DISPLAY_FIRST_LAST || `Player ${idNum}`);

        const projection = generateProjection({
          id: String(idNum),
          seasonStats,
          last5Games: [],
          injury: undefined,
        } as unknown as Player);

        return {
          id: String(idNum),
          name: fullName,
          firstName: firstName || fullName.split(' ')[0] || 'Player',
          lastName: lastName || fullName.split(' ').slice(-1)[0] || 'NBA',
          number: 0,
          position: mapPosition(String(stats.POS || row.POSITION || '')),
          team: {
            id: String(stats.TEAM_ID || row.TEAM_ID || abbreviation.toLowerCase()),
            name: String(stats.TEAM_NAME || row.TEAM_NAME || abbreviation),
            abbreviation,
            city: String(row.TEAM_CITY || ''),
            conference: 'West',
            division: 'Unknown',
            primaryColor: colors.primaryColor,
            secondaryColor: colors.secondaryColor,
          },
          height: String(row.HEIGHT || "6'6\""),
          weight: toNumber(row.WEIGHT, 215),
          age: toNumber(row.AGE, 27),
          experience: toNumber(row.EXP, 1),
          college: String(row.SCHOOL || 'N/A'),
          imageUrl: '',
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
        } as Player;
      })
      .filter((p): p is Player => Boolean(p))
      .filter((p) => (p.seasonStats.minutes || 0) > 0 || (p.seasonStats.points || 0) > 0);

    const warning = playersRawResult.warning || seasonStatsResult.warning;
    const errorCode = playersRawResult.errorCode || seasonStatsResult.errorCode;
    return {
      data: players,
      source: players.length > 0 ? 'nba-stats' : playersRawResult.source,
      warning,
      errorCode,
    };
  }

  async getPlayerById(playerId: string, season?: string): Promise<ProviderResponse<Player | null>> {
    const playersResult = await this.getPlayers(season);
    const player = playersResult.data.find((p) => p.id === String(playerId)) || null;
    return {
      data: player,
      source: playersResult.source,
      warning: player ? playersResult.warning : (playersResult.warning || 'Player not found'),
      errorCode: playersResult.errorCode,
    };
  }

  async getPlayerStats(playerId: string, season?: string): Promise<ProviderResponse<PlayerStatsPayload | null>> {
    const normalizedSeason = normalizeSeason(season);
    const gameLogResult = await this.request('playergamelog', {
      PlayerID: playerId,
      Season: normalizedSeason,
      SeasonType: 'Regular Season',
      LeagueID: '00',
    });
    const rows = rowsFromResultSet(findResultSet(gameLogResult.data, ['playergamelog']));
    if (rows.length === 0) {
      return {
        data: null,
        source: gameLogResult.source,
        warning: gameLogResult.warning || 'No player game logs found',
        errorCode: gameLogResult.errorCode,
      };
    }

    const mapped = rows.map((row) => ({
      points: toNumber(row.PTS),
      assists: toNumber(row.AST),
      rebounds: toNumber(row.REB),
      minutes: toNumber(row.MIN),
      fieldGoalPercentage: toNumber(row.FG_PCT) * 100,
      threePointPercentage: toNumber(row.FG3_PCT) * 100,
      freeThrowPercentage: toNumber(row.FT_PCT) * 100,
      steals: toNumber(row.STL),
      blocks: toNumber(row.BLK),
      turnovers: toNumber(row.TOV),
      matchup: String(row.MATCHUP || ''),
    }));

    const avg = (list: any[]) => {
      const size = list.length || 1;
      return {
        points: list.reduce((s, x) => s + x.points, 0) / size,
        assists: list.reduce((s, x) => s + x.assists, 0) / size,
        rebounds: list.reduce((s, x) => s + x.rebounds, 0) / size,
        minutes: list.reduce((s, x) => s + x.minutes, 0) / size,
        fieldGoalPercentage: list.reduce((s, x) => s + x.fieldGoalPercentage, 0) / size,
        threePointPercentage: list.reduce((s, x) => s + x.threePointPercentage, 0) / size,
        freeThrowPercentage: list.reduce((s, x) => s + x.freeThrowPercentage, 0) / size,
        steals: list.reduce((s, x) => s + x.steals, 0) / size,
        blocks: list.reduce((s, x) => s + x.blocks, 0) / size,
        turnovers: list.reduce((s, x) => s + x.turnovers, 0) / size,
      };
    };

    const last5 = mapped.slice(0, 5);
    const last10 = mapped.slice(0, 10);
    const home = mapped.filter((m) => m.matchup.includes(' vs. '));
    const away = mapped.filter((m) => m.matchup.includes(' @ '));

    return {
      data: {
        season: avg(mapped),
        last5,
        last10,
        career: null,
        home: home.length ? avg(home) : null,
        away: away.length ? avg(away) : null,
        vsConference: null,
        vsDivision: null,
      },
      source: 'nba-stats',
      warning: gameLogResult.warning,
      errorCode: gameLogResult.errorCode,
    };
  }

  async getGamesToday(dateISO?: string): Promise<ProviderResponse<GameDTO[]>> {
    const scoreboardResult = await this.request('scoreboardv2', {
      DayOffset: 0,
      GameDate: todayForScoreboard(dateISO),
      LeagueID: '00',
    });
    const headersRows = rowsFromResultSet(findResultSet(scoreboardResult.data, ['gameheader']));
    const lineScoreRows = rowsFromResultSet(findResultSet(scoreboardResult.data, ['linescore']));
    const lineByGame = new Map<string, AnyRecord[]>();
    for (const row of lineScoreRows) {
      const key = String(row.GAME_ID || '');
      if (!lineByGame.has(key)) lineByGame.set(key, []);
      lineByGame.get(key)!.push(row);
    }

    const games: GameDTO[] = headersRows.map((row) => {
      const gameId = String(row.GAME_ID || '');
      const lines = lineByGame.get(gameId) || [];
      const home = lines.find((l) => String(l.TEAM_ID) === String(row.HOME_TEAM_ID)) || lines[0] || {};
      const away = lines.find((l) => String(l.TEAM_ID) === String(row.VISITOR_TEAM_ID)) || lines[1] || {};
      const statusId = toNumber(row.GAME_STATUS_ID, 1);
      const status = statusId === 3 ? 'final' : statusId === 2 ? 'live' : 'scheduled';
      const statusText = String(row.GAME_STATUS_TEXT || '');
      const displayGameTime = status === 'scheduled'
        ? toLocal24hFromEt(String(row.GAME_DATE_EST || dateISO || ''), statusText, this.appTimezone)
        : statusText;

      return {
        id: gameId,
        gameId,
        status,
        GameStatus: status === 'final' ? 3 : status === 'live' ? 2 : 1,
        date: String(row.GAME_DATE_EST || dateISO || ''),
        gameTime: displayGameTime,
        homeTeam: {
          id: String(row.HOME_TEAM_ID || home.TEAM_ID || ''),
          abbreviation: String(home.TEAM_ABBREVIATION || 'HOME'),
          name: String(home.TEAM_NAME || home.TEAM_CITY_NAME || 'Home'),
          city: String(home.TEAM_CITY_NAME || ''),
        },
        awayTeam: {
          id: String(row.VISITOR_TEAM_ID || away.TEAM_ID || ''),
          abbreviation: String(away.TEAM_ABBREVIATION || 'AWAY'),
          name: String(away.TEAM_NAME || away.TEAM_CITY_NAME || 'Away'),
          city: String(away.TEAM_CITY_NAME || ''),
        },
        homeScore: toNumber(home.PTS),
        awayScore: toNumber(away.PTS),
      };
    });

    return {
      data: games,
      source: games.length > 0 ? 'nba-stats' : scoreboardResult.source,
      warning: scoreboardResult.warning,
      errorCode: scoreboardResult.errorCode,
    };
  }

  async getGameBoxscore(gameId: string): Promise<ProviderResponse<any>> {
    const result = await this.request('boxscoretraditionalv2', {
      EndPeriod: 10,
      EndRange: 55800,
      GameID: gameId,
      RangeType: 2,
      StartPeriod: 1,
      StartRange: 0,
    });

    const teamStatsRows = rowsFromResultSet(findResultSet(result.data, ['teamstats']));
    const playerStatsRows = rowsFromResultSet(findResultSet(result.data, ['playerstats']));
    if (teamStatsRows.length < 2) {
      return {
        data: null,
        source: result.source,
        warning: result.warning || 'No boxscore data found',
        errorCode: result.errorCode,
      };
    }

    const [t1, t2] = teamStatsRows;
    const mapTeam = (team: AnyRecord) => ({
      teamId: String(team.TEAM_ID || ''),
      abbreviation: String(team.TEAM_ABBREVIATION || ''),
      totalPoints: toNumber(team.PTS),
      players: playerStatsRows
        .filter((p) => String(p.TEAM_ID) === String(team.TEAM_ID))
        .map((p) => ({
          playerId: String(p.PLAYER_ID || ''),
          name: String(p.PLAYER_NAME || ''),
          minutes: String(p.MIN || ''),
          points: toNumber(p.PTS),
          assists: toNumber(p.AST),
          rebounds: toNumber(p.REB),
          steals: toNumber(p.STL),
          blocks: toNumber(p.BLK),
          turnovers: toNumber(p.TO),
        })),
    });

    return {
      data: {
        gameId,
        homeTeam: mapTeam(t1),
        awayTeam: mapTeam(t2),
      },
      source: 'nba-stats',
      warning: result.warning,
      errorCode: result.errorCode,
    };
  }

  async getTeams(season?: string): Promise<ProviderResponse<TeamWithStats[]>> {
    const normalizedSeason = normalizeSeason(season);
    const result = await this.request('leaguedashteamstats', {
      Conference: '',
      DateFrom: '',
      DateTo: '',
      Division: '',
      GameScope: '',
      GameSegment: '',
      LastNGames: 0,
      LeagueID: '00',
      Location: '',
      MeasureType: 'Base',
      Month: 0,
      OpponentTeamID: 0,
      Outcome: '',
      PORound: 0,
      PaceAdjust: 'N',
      PerMode: 'PerGame',
      Period: 0,
      PlusMinus: 'N',
      Rank: 'N',
      Season: normalizedSeason,
      SeasonSegment: '',
      SeasonType: 'Regular Season',
      ShotClockRange: '',
      StarterBench: '',
      TeamID: 0,
      TwoWay: 0,
      VsConference: '',
      VsDivision: '',
    });

    const rows = rowsFromResultSet(findResultSet(result.data, ['leaguedashteamstats']));
    const teams: TeamWithStats[] = rows.map((r) => {
      const name = String(r.TEAM_NAME || 'NBA');
      const abbreviation = String(r.TEAM_ABBREVIATION || name.slice(0, 3).toUpperCase());
      const colors = getTeamColors(abbreviation);
      return {
        id: String(r.TEAM_ID || abbreviation.toLowerCase()),
        name,
        abbreviation,
        city: String(name.split(' ').slice(0, -1).join(' ') || ''),
        conference: 'West',
        division: 'Unknown',
        primaryColor: colors.primaryColor,
        secondaryColor: colors.secondaryColor,
        stats: {
          wins: toNumber(r.W),
          losses: toNumber(r.L),
          pointsPerGame: toNumber(r.PTS),
          assistsPerGame: toNumber(r.AST),
          reboundsPerGame: toNumber(r.REB),
          stealsPerGame: toNumber(r.STL),
          blocksPerGame: toNumber(r.BLK),
          turnoversPerGame: toNumber(r.TOV),
          fieldGoalPercentage: toNumber(r.FG_PCT) * 100,
          threePointPercentage: toNumber(r.FG3_PCT) * 100,
          freeThrowPercentage: toNumber(r.FT_PCT) * 100,
          offensiveRating: toNumber(r.OFF_RATING),
          defensiveRating: toNumber(r.DEF_RATING),
          pace: toNumber(r.PACE),
        },
        streak: 'N/A',
        lastGames: ['W', 'L', 'W', 'L', 'W'],
        rank: { conference: toNumber(r.CFID), overall: toNumber(r.RANK) },
      } as TeamWithStats;
    });

    return {
      data: teams,
      source: teams.length > 0 ? 'nba-stats' : result.source,
      warning: result.warning,
      errorCode: result.errorCode,
    };
  }

  async getTeamRoster(teamId: string, season?: string): Promise<ProviderResponse<Player[]>> {
    const normalizedSeason = normalizeSeason(season);
    const rosterResult = await this.request('commonteamroster', {
      LeagueID: '00',
      Season: normalizedSeason,
      TeamID: teamId,
    });

    const rosterRows = rowsFromResultSet(findResultSet(rosterResult.data, ['commonteamroster']));
    const rosterIds = new Set(rosterRows.map((r) => String(r.PLAYER_ID)).filter(Boolean));
    if (rosterIds.size === 0) {
      return {
        data: [],
        source: rosterResult.source,
        warning: rosterResult.warning || 'No roster returned by NBA Stats',
        errorCode: rosterResult.errorCode,
      };
    }

    const playersResult = await this.getPlayers(normalizedSeason);
    const players = playersResult.data.filter((p) => rosterIds.has(String(p.id)));
    return {
      data: players,
      source: playersResult.source,
      warning: playersResult.warning || rosterResult.warning,
      errorCode: playersResult.errorCode || rosterResult.errorCode,
    };
  }
}
