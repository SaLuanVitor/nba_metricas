import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';
import { getConferenceByAbbreviation } from '@/lib/nba/team-metadata';
import { buildPredictionDebate } from '@/lib/ai/prediction-debate';
import { buildPlayerSpecialistPrediction, buildTeamSpecialistPrediction } from '@/lib/ai/specialists';
import { getRecentSpecialistLearnings, saveSpecialistLearning, type LearningStatus } from '@/lib/ai/learning-store';
import type { Player, TeamWithStats } from '@/lib/types';

type Source = 'nba-stats' | 'balldontlie' | 'boltodds' | 'none';
type SourceHealth = 'ok' | 'degraded';
type CacheStatus = 'fresh' | 'stale' | 'rejected';
type ErrorCode =
  | 'UPSTREAM_UNAUTHORIZED'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_BAD_RESPONSE'
  | undefined;

type MatchupServiceResult = {
  success: true;
  data: any | null;
  source: Source;
  sourceHealth: SourceHealth;
  cacheStatus: CacheStatus;
  warning?: string;
  errorCode?: ErrorCode;
};

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeGameStatus(game: any): 'scheduled' | 'live' | 'final' {
  const status = String(game?.status || '').toLowerCase();
  if (status === 'scheduled' || Number(game?.GameStatus) === 1) return 'scheduled';
  if (status === 'live' || Number(game?.GameStatus) === 2) return 'live';
  return 'final';
}

function findTeamForGameSide(teams: TeamWithStats[], gameTeam: { id?: string; abbreviation?: string }): TeamWithStats | null {
  const teamId = String(gameTeam?.id || '');
  const abbr = String(gameTeam?.abbreviation || '').toUpperCase();
  return (
    teams.find((team) => String(team.id) === teamId) ||
    teams.find((team) => String(team.id).toUpperCase() === abbr) ||
    teams.find((team) => String(team.abbreviation || '').toUpperCase() === abbr) ||
    null
  );
}

function buildFallbackTeam(gameTeam: any): TeamWithStats {
  const abbreviation = String(gameTeam?.abbreviation || 'NBA').toUpperCase();
  const conference = getConferenceByAbbreviation(abbreviation) || 'East';
  return {
    id: String(gameTeam?.id || abbreviation.toLowerCase()),
    name: String(gameTeam?.name || abbreviation),
    abbreviation,
    city: String(gameTeam?.city || ''),
    conference,
    division: 'Unknown',
    primaryColor: '#1D428A',
    secondaryColor: '#C8102E',
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
    streak: 'N0',
    lastGames: [],
    rank: { conference: 0, overall: 0 },
    record: {
      winPct: 0,
      gamesPlayed: 0,
      last10: '0-0',
      streak: 'N0',
    },
  };
}

function rosterFromPlayers(players: Player[], team: TeamWithStats, gameTeam: any): Player[] {
  const teamId = String(team.id || '');
  const abbr = String(gameTeam?.abbreviation || team.abbreviation || '').toUpperCase();
  const list = players.filter((player) => {
    const playerTeamId = String(player.team?.id || '');
    const playerAbbr = String(player.team?.abbreviation || '').toUpperCase();
    return playerTeamId === teamId || playerAbbr === abbr;
  });
  return list;
}

function summarizeLearningStatuses(statuses: LearningStatus[]) {
  return statuses.reduce(
    (acc, status) => {
      acc[status] += 1;
      return acc;
    },
    {
      saved: 0,
      skipped_window: 0,
      skipped_no_change: 0,
      disabled: 0,
    } as Record<LearningStatus, number>
  );
}

export async function getMatchupPrediction(
  gameId: string,
  options?: { persistLearners?: boolean }
): Promise<MatchupServiceResult> {
  const persistLearners = options?.persistLearners ?? true;
  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const today = getLocalISODate();

  const [gamesResult, teamsResult, playersResult] = await Promise.all([
    orchestrator.getGamesToday(today),
    orchestrator.getTeams(season),
    orchestrator.getPlayers(season),
  ]);

  const game = toArray(gamesResult.data).find(
    (item: any) => String(item.gameId || item.id) === String(gameId)
  );

  if (!game) {
    return {
      success: true,
      data: null,
      source: gamesResult.source as Source,
      sourceHealth: gamesResult.sourceHealth ?? 'degraded',
      cacheStatus: gamesResult.cacheStatus ?? 'rejected',
      warning: gamesResult.warning || 'Game not found',
      errorCode: gamesResult.errorCode as ErrorCode,
    };
  }

  const status = normalizeGameStatus(game);
  if (status === 'final') {
    return {
      success: true,
      data: null,
      source: gamesResult.source as Source,
      sourceHealth: gamesResult.sourceHealth ?? 'degraded',
      cacheStatus: gamesResult.cacheStatus ?? 'rejected',
      warning: 'Only live or scheduled games are allowed for predictions',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  const teams = toArray(teamsResult.data);
  const players = toArray(playersResult.data);
  const homeBaseTeam = findTeamForGameSide(teams, game.homeTeam) || buildFallbackTeam(game.homeTeam);
  const awayBaseTeam = findTeamForGameSide(teams, game.awayTeam) || buildFallbackTeam(game.awayTeam);

  let homeRoster = rosterFromPlayers(players, homeBaseTeam, game.homeTeam);
  let awayRoster = rosterFromPlayers(players, awayBaseTeam, game.awayTeam);

  if (homeRoster.length === 0 && homeBaseTeam.id) {
    const homeRosterResult = await orchestrator.getTeamRoster(homeBaseTeam.id, season);
    homeRoster = toArray(homeRosterResult.data);
  }
  if (awayRoster.length === 0 && awayBaseTeam.id) {
    const awayRosterResult = await orchestrator.getTeamRoster(awayBaseTeam.id, season);
    awayRoster = toArray(awayRosterResult.data);
  }

  const homeSpecialist = buildTeamSpecialistPrediction(homeBaseTeam, homeRoster);
  const awaySpecialist = buildTeamSpecialistPrediction(awayBaseTeam, awayRoster);
  const homePlayerSpecialists = homeRoster.map((player) => ({ player, specialist: buildPlayerSpecialistPrediction(player) }));
  const awayPlayerSpecialists = awayRoster.map((player) => ({ player, specialist: buildPlayerSpecialistPrediction(player) }));

  const { rounds, verdict } = buildPredictionDebate({
    homeTeam: homeBaseTeam,
    awayTeam: awayBaseTeam,
    homeTeamConfidence: Number(homeSpecialist.prediction?.confidence || 60),
    awayTeamConfidence: Number(awaySpecialist.prediction?.confidence || 60),
    homeRosterCount: homeRoster.length,
    awayRosterCount: awayRoster.length,
    sourceHealth: (gamesResult.sourceHealth === 'ok' && teamsResult.sourceHealth === 'ok' && playersResult.sourceHealth === 'ok')
      ? 'ok'
      : 'degraded',
    warning: gamesResult.warning || teamsResult.warning || playersResult.warning,
  });

  const persistedStatuses: LearningStatus[] = [];
  const playerPersistenceMap = new Map<string, { persisted: boolean; status: LearningStatus; lastPersistedAt?: string }>();
  let teamHomePersist = { persisted: false, status: 'disabled' as LearningStatus, lastPersistedAt: undefined as string | undefined };
  let teamAwayPersist = { persisted: false, status: 'disabled' as LearningStatus, lastPersistedAt: undefined as string | undefined };

  if (persistLearners) {
    const persistPromises: Array<Promise<void>> = [];

    persistPromises.push(
      saveSpecialistLearning({
        entityType: 'team',
        entityId: homeBaseTeam.id,
        source: (teamsResult.source || gamesResult.source) as Source,
        confidence: Number(homeSpecialist.prediction?.confidence || 0),
        learning: homeSpecialist,
        sourceHealth: teamsResult.sourceHealth ?? 'degraded',
        cacheStatus: teamsResult.cacheStatus ?? 'rejected',
        tags: ['prediction', 'team', homeBaseTeam.abbreviation],
      }).then((result) => {
        teamHomePersist = { persisted: result.persisted, status: result.status, lastPersistedAt: result.lastPersistedAt };
        persistedStatuses.push(result.status);
      })
    );

    persistPromises.push(
      saveSpecialistLearning({
        entityType: 'team',
        entityId: awayBaseTeam.id,
        source: (teamsResult.source || gamesResult.source) as Source,
        confidence: Number(awaySpecialist.prediction?.confidence || 0),
        learning: awaySpecialist,
        sourceHealth: teamsResult.sourceHealth ?? 'degraded',
        cacheStatus: teamsResult.cacheStatus ?? 'rejected',
        tags: ['prediction', 'team', awayBaseTeam.abbreviation],
      }).then((result) => {
        teamAwayPersist = { persisted: result.persisted, status: result.status, lastPersistedAt: result.lastPersistedAt };
        persistedStatuses.push(result.status);
      })
    );

    for (const item of [...homePlayerSpecialists, ...awayPlayerSpecialists]) {
      persistPromises.push(
        saveSpecialistLearning({
          entityType: 'player',
          entityId: item.player.id,
          source: (playersResult.source || gamesResult.source) as Source,
          confidence: Number(item.specialist.prediction?.confidence || 0),
          learning: item.specialist,
          sourceHealth: playersResult.sourceHealth ?? 'degraded',
          cacheStatus: playersResult.cacheStatus ?? 'rejected',
          tags: ['prediction', 'player', item.player.team?.abbreviation || 'NBA'],
        }).then((result) => {
          playerPersistenceMap.set(item.player.id, {
            persisted: result.persisted,
            status: result.status,
            lastPersistedAt: result.lastPersistedAt,
          });
          persistedStatuses.push(result.status);
        })
      );
    }

    await Promise.all(persistPromises);
  }

  const [homeRecentLearnings, awayRecentLearnings] = await Promise.all([
    getRecentSpecialistLearnings('team', homeBaseTeam.id, 5),
    getRecentSpecialistLearnings('team', awayBaseTeam.id, 5),
  ]);

  const learningSummary = summarizeLearningStatuses(persistedStatuses);
  const sourceHealth: SourceHealth =
    gamesResult.sourceHealth === 'ok' && teamsResult.sourceHealth === 'ok' && playersResult.sourceHealth === 'ok'
      ? 'ok'
      : 'degraded';

  return {
    success: true,
    data: {
      game: {
        id: String(game.gameId || game.id),
        status,
        gameTime: game.gameTime,
        date: game.date,
        watchUrl: game.watchUrl,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: Number(game.homeScore || 0),
        awayScore: Number(game.awayScore || 0),
      },
      teamSpecialists: {
        home: {
          teamId: homeBaseTeam.id,
          ...homeSpecialist,
          persisted: teamHomePersist.persisted,
          learningStatus: teamHomePersist.status,
          lastPersistedAt: teamHomePersist.lastPersistedAt || null,
          recentLearnings: homeRecentLearnings,
        },
        away: {
          teamId: awayBaseTeam.id,
          ...awaySpecialist,
          persisted: teamAwayPersist.persisted,
          learningStatus: teamAwayPersist.status,
          lastPersistedAt: teamAwayPersist.lastPersistedAt || null,
          recentLearnings: awayRecentLearnings,
        },
      },
      playerSpecialists: {
        home: homePlayerSpecialists.map(({ player, specialist }) => {
          const persist = playerPersistenceMap.get(player.id);
          return {
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            teamAbbreviation: player.team?.abbreviation,
            ...specialist,
            persisted: persist?.persisted ?? false,
            learningStatus: persist?.status ?? 'disabled',
            lastPersistedAt: persist?.lastPersistedAt || null,
          };
        }),
        away: awayPlayerSpecialists.map(({ player, specialist }) => {
          const persist = playerPersistenceMap.get(player.id);
          return {
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            teamAbbreviation: player.team?.abbreviation,
            ...specialist,
            persisted: persist?.persisted ?? false,
            learningStatus: persist?.status ?? 'disabled',
            lastPersistedAt: persist?.lastPersistedAt || null,
          };
        }),
      },
      debateRounds: rounds,
      finalVerdict: verdict,
      trustScore: verdict.trustScore,
      learningSummary,
      updatedAt: new Date().toISOString(),
    },
    source: (gamesResult.source !== 'none'
      ? gamesResult.source
      : teamsResult.source !== 'none'
        ? teamsResult.source
        : playersResult.source) as Source,
    sourceHealth,
    cacheStatus: (gamesResult.cacheStatus !== 'rejected'
      ? gamesResult.cacheStatus
      : teamsResult.cacheStatus !== 'rejected'
        ? teamsResult.cacheStatus
        : playersResult.cacheStatus) as CacheStatus,
    warning: gamesResult.warning || teamsResult.warning || playersResult.warning,
    errorCode: (gamesResult.errorCode || teamsResult.errorCode || playersResult.errorCode) as ErrorCode,
  };
}
