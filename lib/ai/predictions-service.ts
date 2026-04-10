import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getLocalISODate } from '@/lib/date-utils';
import { getConferenceByAbbreviation } from '@/lib/nba/team-metadata';
import { buildPredictionDebate } from '@/lib/ai/prediction-debate';
import { buildPlayerAgentDebate, buildPlayerMetricScenarios, buildPlayerStatusPrediction } from '@/lib/ai/player-scenarios';
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

type PlayerPredictionServiceResult = MatchupServiceResult;
type PlayerPredictionSourceState = 'cache_local' | 'fresh_server' | 'stale';
type CachedPlayerPredictionEntry = {
  key: string;
  data: any;
  source: Source;
  sourceHealth: SourceHealth;
  cacheStatus: CacheStatus;
  warning?: string;
  errorCode?: ErrorCode;
  cachedAt: string;
};
type MatchupPlayerSummaryCacheEntry = {
  key: string;
  updatedAt: string;
  summaries: {
    home: any[];
    away: any[];
  };
};

const PLAYER_PREDICTION_CACHE_TTL_MS = 5 * 60 * 1000;
const MATCHUP_PLAYER_SUMMARY_CACHE_TTL_MS = 3 * 60 * 1000;
const REQUIRED_PLAYER_METRICS = ['points', 'assists', 'rebounds', 'minutes', 'fouls', 'steals', 'blocks', 'turnovers'] as const;
const playerPredictionCache = new Map<string, CachedPlayerPredictionEntry>();
const playerPredictionInflight = new Map<string, Promise<PlayerPredictionServiceResult>>();
const matchupPlayerSummaryCache = new Map<string, MatchupPlayerSummaryCacheEntry>();

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

function mapRiskLevel(score: number): 'baixo' | 'medio' | 'alto' {
  if (score >= 75) return 'baixo';
  if (score >= 55) return 'medio';
  return 'alto';
}

function buildClientSummary(params: {
  verdict: any;
  game: any;
  rounds: any[];
}): {
  recommendation: string;
  riskLevel: 'baixo' | 'medio' | 'alto';
  keyDrivers: string[];
  whatCouldChange: string[];
} {
  const { verdict, game, rounds } = params;
  const winner = String(verdict?.winner || 'draw');
  const home = String(game?.homeTeam?.abbreviation || 'Casa');
  const away = String(game?.awayTeam?.abbreviation || 'Visitante');
  const trustScore = Number(verdict?.trustScore || 0);
  const riskLevel = mapRiskLevel(trustScore);

  const recommendation =
    winner === 'home'
      ? `${home} aparece mais forte neste momento.`
      : winner === 'away'
        ? `${away} aparece mais forte neste momento.`
        : 'Confronto equilibrado neste momento.';

  const keyDrivers = (rounds || [])
    .slice(0, 3)
    .map((round: any) => String(round?.verification || 'Sem validação detalhada'));

  const whatCouldChange = [
    'Mudança de status de lesão de jogador-chave.',
    'Atualização de rotação/minutagem próximo ao início do jogo.',
    'Oscilação de forma recente e ritmo do confronto ao vivo.',
  ];

  return {
    recommendation,
    riskLevel,
    keyDrivers,
    whatCouldChange,
  };
}

function buildCompactPlayerSummary(params: {
  player: Player;
  playerTeam: TeamWithStats;
  opponentTeam: TeamWithStats;
  sourceState: PlayerPredictionSourceState;
  sourceHealth: SourceHealth;
  cachedAt: string;
  updatedAt: string;
}) {
  const { player, playerTeam, opponentTeam, sourceState, sourceHealth, cachedAt, updatedAt } = params;
  const last5Stats = Array.isArray(player.last5Games) ? player.last5Games : [];
  const coverageFlags = [
    Number(last5Stats.length >= 3),
    Number(Boolean(player.injury)),
    Number((player.seasonStats?.minutes || 0) > 0 || (player.seasonStats?.points || 0) > 0),
  ];
  const coverageRatio = Number((coverageFlags.reduce((sum, v) => sum + v, 0) / coverageFlags.length).toFixed(2));
  const statusPrediction = buildPlayerStatusPrediction(player, coverageRatio);
  const metricScenarios = buildPlayerMetricScenarios(player, last5Stats as any[], coverageRatio);
  const debate = buildPlayerAgentDebate({
    player,
    playerTeam,
    opponentTeam,
    statusPrediction,
    metricScenarios,
    sourceHealth,
    coverageRatio,
  });

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    teamAbbreviation: player.team?.abbreviation,
    statusPrediction,
    trustScore: debate.trustScore,
    confidence: statusPrediction.confidence,
    learningStatus: 'cached',
    metricScenarios,
    sourceState,
    cacheHit: sourceState !== 'fresh_server',
    cachedAt,
    updatedAt,
  };
}

function pctDelta(projected: number, season: number): number {
  if (!Number.isFinite(season) || season === 0) return 0;
  return Number((((projected - season) / season) * 100).toFixed(1));
}

export async function getMatchupPrediction(
  gameId: string,
  options?: { persistLearners?: boolean; refresh?: boolean; forcePersistLearning?: boolean }
): Promise<MatchupServiceResult> {
  const persistLearners = options?.persistLearners ?? true;
  const refresh = options?.refresh ?? false;
  const forcePersistLearning = options?.forcePersistLearning ?? false;
  const processRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (refresh) {
    console.info(`[MATCHUP_REFRESH_REQUESTED] gameId=${gameId} processRunId=${processRunId}`);
  }
  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const today = getLocalISODate();

  const [gamesResult, teamsResult, playersResult] = await Promise.all([
    orchestrator.getGamesToday(today, { forceRefresh: refresh }),
    orchestrator.getTeams(season, { forceRefresh: refresh }),
    orchestrator.getPlayers(season, { forceRefresh: refresh }),
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
    const homeRosterResult = await orchestrator.getTeamRoster(homeBaseTeam.id, season, { forceRefresh: refresh });
    homeRoster = toArray(homeRosterResult.data);
  }
  if (awayRoster.length === 0 && awayBaseTeam.id) {
    const awayRosterResult = await orchestrator.getTeamRoster(awayBaseTeam.id, season, { forceRefresh: refresh });
    awayRoster = toArray(awayRosterResult.data);
  }

  const matchupPlayerSummaryCacheKey = `prediction-matchup-players:${String(game.gameId || game.id)}`;
  const cachedMatchupSummaries = matchupPlayerSummaryCache.get(matchupPlayerSummaryCacheKey);
  const now = Date.now();
  let playerPredictionsSummary: { home: any[]; away: any[] };
  let summaryUpdatedAt = new Date().toISOString();
  if (
    !refresh &&
    cachedMatchupSummaries
    && now - new Date(cachedMatchupSummaries.updatedAt).getTime() < MATCHUP_PLAYER_SUMMARY_CACHE_TTL_MS
  ) {
    playerPredictionsSummary = cachedMatchupSummaries.summaries;
    summaryUpdatedAt = cachedMatchupSummaries.updatedAt;
  } else {
    if (refresh && cachedMatchupSummaries) {
      console.info(`[MATCHUP_CACHE_BYPASSED] key=${matchupPlayerSummaryCacheKey} reason=manual_refresh`);
    }
    const cachedAt = new Date().toISOString();
    playerPredictionsSummary = {
      home: homeRoster.map((player) =>
        buildCompactPlayerSummary({
          player,
          playerTeam: homeBaseTeam,
          opponentTeam: awayBaseTeam,
          sourceState: 'cache_local',
          sourceHealth: playersResult.sourceHealth ?? 'degraded',
          cachedAt,
          updatedAt: cachedAt,
        })
      ),
      away: awayRoster.map((player) =>
        buildCompactPlayerSummary({
          player,
          playerTeam: awayBaseTeam,
          opponentTeam: homeBaseTeam,
          sourceState: 'cache_local',
          sourceHealth: playersResult.sourceHealth ?? 'degraded',
          cachedAt,
          updatedAt: cachedAt,
        })
      ),
    };
    summaryUpdatedAt = cachedAt;
    matchupPlayerSummaryCache.set(matchupPlayerSummaryCacheKey, {
      key: matchupPlayerSummaryCacheKey,
      updatedAt: summaryUpdatedAt,
      summaries: playerPredictionsSummary,
    });
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
        forcePersist: forcePersistLearning,
        processRunId,
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
        forcePersist: forcePersistLearning,
        processRunId,
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
          forcePersist: forcePersistLearning,
          processRunId,
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

  const clientSummary = buildClientSummary({
    verdict,
    game,
    rounds,
  });

  const output: MatchupServiceResult = {
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
      playerPredictionsSummary,
      debateRounds: rounds,
      finalVerdict: verdict,
      trustScore: verdict.trustScore,
      clientSummary,
      learningSummary,
      processRunId,
      refreshedAt: refresh ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      playerSummariesUpdatedAt: summaryUpdatedAt,
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

  if (refresh) {
    console.info(
      `[MATCHUP_REFRESH_COMPLETED] gameId=${gameId} processRunId=${processRunId} trustScore=${Number(output.data?.finalVerdict?.trustScore || 0)} cacheStatus=${output.cacheStatus}`
    );
  }

  return output;
}

export async function getMatchupPlayerPrediction(
  gameId: string,
  playerId: string,
  options?: { refresh?: boolean }
): Promise<PlayerPredictionServiceResult> {
  const refresh = options?.refresh ?? false;
  const cacheKey = `prediction-player:${gameId}:${playerId}`;
  const now = Date.now();
  const cached = playerPredictionCache.get(cacheKey);

  if (!refresh && cached) {
    const age = now - new Date(cached.cachedAt).getTime();
    if (age < PLAYER_PREDICTION_CACHE_TTL_MS) {
      console.info(`[PLAYER_PREDICTION_CACHE_HIT] gameId=${gameId} playerId=${playerId} ageMs=${age}`);
      return {
        success: true,
        data: {
          ...cached.data,
          sourceState: cached.cacheStatus === 'stale' ? 'stale' : 'cache_local',
          cacheHit: true,
          cachedAt: cached.cachedAt,
          updatedAt: cached.cachedAt,
        },
        source: cached.source,
        sourceHealth: cached.sourceHealth,
        cacheStatus: cached.cacheStatus,
        warning: cached.warning,
        errorCode: cached.errorCode,
      };
    }
  }

  const inflight = playerPredictionInflight.get(cacheKey);
  if (!refresh && inflight) return inflight;

  if (refresh) {
    console.info(`[PLAYER_PREDICTION_REFRESH_REQUESTED] gameId=${gameId} playerId=${playerId}`);
  }

  const task = getMatchupPlayerPredictionInternal(gameId, playerId, cacheKey);
  playerPredictionInflight.set(cacheKey, task);
  try {
    const result = await task;
    if (refresh) {
      console.info(`[PLAYER_PREDICTION_REFRESH_COMPLETED] gameId=${gameId} playerId=${playerId} source=${result.source} cacheStatus=${result.cacheStatus}`);
    }
    return result;
  } catch (error) {
    console.error(`[PLAYER_PREDICTION_REFRESH_FAILED] gameId=${gameId} playerId=${playerId}`, error);
    throw error;
  } finally {
    playerPredictionInflight.delete(cacheKey);
  }
}

async function getMatchupPlayerPredictionInternal(
  gameId: string,
  playerId: string,
  cacheKey: string
): Promise<PlayerPredictionServiceResult> {
  const matchupResult = await getMatchupPrediction(gameId, { persistLearners: true });
  if (!matchupResult.data) return matchupResult;

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const [playerResult, statsResult] = await Promise.all([
    orchestrator.getPlayerById(playerId, season),
    orchestrator.getPlayerStats(playerId, season),
  ]);

  const player = playerResult.data;
  if (!player) {
    return {
      success: true,
      data: null,
      source: matchupResult.source,
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'Player not found for selected matchup',
      errorCode: playerResult.errorCode as ErrorCode,
    };
  }

  const game = matchupResult.data.game;
  const homeTeam = matchupResult.data.teamSpecialists?.home?.teamId;
  const awayTeam = matchupResult.data.teamSpecialists?.away?.teamId;
  const isHomePlayer =
    String(player.team?.id || '') === String(homeTeam || '') ||
    String(player.team?.abbreviation || '').toUpperCase() === String(game.homeTeam?.abbreviation || '').toUpperCase();
  const belongsToGame =
    isHomePlayer ||
    String(player.team?.id || '') === String(awayTeam || '') ||
    String(player.team?.abbreviation || '').toUpperCase() === String(game.awayTeam?.abbreviation || '').toUpperCase();

  if (!belongsToGame) {
    return {
      success: true,
      data: null,
      source: matchupResult.source,
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'Selected player is not part of this matchup',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    };
  }

  const teamsResult = await orchestrator.getTeams(season);
  const teams = toArray(teamsResult.data);
  const playerTeam = teams.find((team) => String(team.id) === String(player.team?.id || '')) || buildFallbackTeam(player.team);
  const opponentTeam = teams.find((team) => String(team.id) !== String(playerTeam.id) && (
    String(team.id) === String(isHomePlayer ? awayTeam : homeTeam || '') ||
    String(team.abbreviation).toUpperCase() === String(isHomePlayer ? game.awayTeam?.abbreviation : game.homeTeam?.abbreviation).toUpperCase()
  )) || buildFallbackTeam(isHomePlayer ? game.awayTeam : game.homeTeam);

  const last5Stats = Array.isArray(statsResult.data?.last5) ? statsResult.data!.last5 : [];
  const coverageFlags = [
    Number(last5Stats.length >= 3),
    Number(Boolean(player.injury)),
    Number((player.seasonStats?.minutes || 0) > 0 || (player.seasonStats?.points || 0) > 0),
  ];
  const coverageRatio = Number((coverageFlags.reduce((sum, v) => sum + v, 0) / coverageFlags.length).toFixed(2));
  player.last5Games = last5Stats.map((row: any) => ({
    points: Number(row.points || 0),
    assists: Number(row.assists || 0),
    rebounds: Number(row.rebounds || 0),
    minutes: Number(row.minutes || 0),
    fieldGoalPercentage: Number(row.fieldGoalPercentage || 0),
    threePointPercentage: Number(row.threePointPercentage || 0),
    freeThrowPercentage: Number(row.freeThrowPercentage || 0),
    steals: Number(row.steals || 0),
    blocks: Number(row.blocks || 0),
    turnovers: Number(row.turnovers || 0),
    fouls: Number(row.fouls || 0),
  }));

  const statusPrediction = buildPlayerStatusPrediction(player, coverageRatio);
  let metricScenarios = buildPlayerMetricScenarios(player, last5Stats, coverageRatio);
  if (!Object.keys(metricScenarios || {}).length) {
    metricScenarios = buildPlayerMetricScenarios(player, [], Math.max(coverageRatio, 0.45));
  } else {
    const fallbackMetrics = buildPlayerMetricScenarios(player, [], Math.max(coverageRatio, 0.45));
    for (const metric of REQUIRED_PLAYER_METRICS) {
      if (!metricScenarios[metric]) metricScenarios[metric] = fallbackMetrics[metric];
    }
  }
  const debate = buildPlayerAgentDebate({
    player,
    playerTeam,
    opponentTeam,
    statusPrediction,
    metricScenarios,
    sourceHealth: matchupResult.sourceHealth,
    coverageRatio,
  });

  const playerSpecialist = buildPlayerSpecialistPrediction(player);
  const learningPayload = {
    specialist: playerSpecialist.specialist,
    prediction: {
      ...playerSpecialist.prediction,
      statusPrediction,
      trustScore: debate.trustScore,
      finalVerdict: debate.finalVerdict,
    },
    explainability: {
      ...playerSpecialist.explainability,
      reasons: debate.reasons,
    },
    metricScenarios,
    agentDebate: debate,
  };
  const learningSave = await saveSpecialistLearning({
    entityType: 'player',
    entityId: player.id,
    source: matchupResult.source,
    confidence: debate.trustScore,
    learning: learningPayload,
    sourceHealth: matchupResult.sourceHealth,
    cacheStatus: matchupResult.cacheStatus,
    tags: ['prediction', 'player-matchup', player.team?.abbreviation || 'NBA'],
  });
  const recentLearnings = await getRecentSpecialistLearnings('player', player.id, 10);

  const projectedPoints = Number(player.projection?.projectedPoints || 0);
  const projectedAssists = Number(player.projection?.projectedAssists || 0);
  const projectedRebounds = Number(player.projection?.projectedRebounds || 0);
  const projectedMinutes = Number(player.projection?.projectedMinutes || 0);
  const seasonPoints = Number(player.seasonStats?.points || 0);
  const seasonAssists = Number(player.seasonStats?.assists || 0);
  const seasonRebounds = Number(player.seasonStats?.rebounds || 0);
  const seasonMinutes = Number(player.seasonStats?.minutes || 0);
  const lastLearning = recentLearnings[0];
  const avgLearningConfidence = recentLearnings.length
    ? Number((recentLearnings.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / recentLearnings.length).toFixed(1))
    : 0;

  const warnings: string[] = [];
  if (matchupResult.warning) warnings.push(matchupResult.warning);
  if (playerResult.warning) warnings.push(playerResult.warning);
  if (statsResult.warning) warnings.push(statsResult.warning);
  if (coverageRatio < 0.55) warnings.push('Low context coverage for this player matchup');
  if (!learningSave.persisted && learningSave.warning) warnings.push(learningSave.warning);
  if (!Object.keys(metricScenarios || {}).length) warnings.push('Insufficient metrics coverage for detailed scenarios');

  const response: PlayerPredictionServiceResult = {
    success: true,
    data: {
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
      },
      statusPrediction,
      metricScenarios,
      agentDebate: {
        rounds: debate.rounds,
        finalVerdict: debate.finalVerdict,
        trustScore: debate.trustScore,
        reasons: debate.reasons,
      },
      trustScore: debate.trustScore,
      learningStatus: learningSave.status,
      lastPersistedAt: learningSave.lastPersistedAt || null,
      recentLearnings,
      coverageRatio,
      game,
      detailedComparison: {
        projected: {
          points: projectedPoints,
          assists: projectedAssists,
          rebounds: projectedRebounds,
          minutes: projectedMinutes,
          fantasyPoints: Number(player.fantasyPoints || 0),
          salary: Number(player.salary || 0),
        },
        season: {
          points: seasonPoints,
          assists: seasonAssists,
          rebounds: seasonRebounds,
          minutes: seasonMinutes,
          fgPct: Number(player.seasonStats?.fieldGoalPercentage || 0),
          threePct: Number(player.seasonStats?.threePointPercentage || 0),
          ftPct: Number(player.seasonStats?.freeThrowPercentage || 0),
        },
        percentages: {
          pointsDeltaPct: pctDelta(projectedPoints, seasonPoints),
          assistsDeltaPct: pctDelta(projectedAssists, seasonAssists),
          reboundsDeltaPct: pctDelta(projectedRebounds, seasonRebounds),
          minutesDeltaPct: pctDelta(projectedMinutes, seasonMinutes),
          pointsConfidencePct: Number(metricScenarios.points?.confidence || 0),
          assistsConfidencePct: Number(metricScenarios.assists?.confidence || 0),
          reboundsConfidencePct: Number(metricScenarios.rebounds?.confidence || 0),
          minutesConfidencePct: Number(metricScenarios.minutes?.confidence || 0),
          overallConfidencePct: Number(statusPrediction.confidence || 0),
          trustScorePct: Number(debate.trustScore || 0),
        },
        training: {
          learningStatus: learningSave.status,
          lastPersistedAt: learningSave.lastPersistedAt || null,
          recentLearningsCount: recentLearnings.length,
          latestLearningAt: lastLearning?.capturedAt || null,
          avgLearningConfidencePct: avgLearningConfidence,
        },
        historyWindowUsed: {
          last5GamesCount: last5Stats.length,
          coverageRatio,
        },
      },
      sourceState: matchupResult.cacheStatus === 'stale' ? 'stale' : 'fresh_server',
      cacheHit: false,
      cachedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    source: matchupResult.source,
    sourceHealth: coverageRatio >= 0.55 ? matchupResult.sourceHealth : 'degraded',
    cacheStatus: matchupResult.cacheStatus,
    warning: warnings.length ? warnings.join(' | ') : undefined,
    errorCode: (matchupResult.errorCode || playerResult.errorCode || statsResult.errorCode) as ErrorCode,
  };

  const matchupSummaryKey = `prediction-matchup-players:${String(gameId)}`;
  const matchupSummary = matchupPlayerSummaryCache.get(matchupSummaryKey);
  if (matchupSummary) {
    const updateSummaryPlayer = (list: any[]) =>
      list.map((row: any) =>
        String(row.playerId) === String(player.id)
          ? {
              ...row,
              statusPrediction,
              trustScore: debate.trustScore,
              confidence: statusPrediction.confidence,
              learningStatus: learningSave.status,
              metricScenarios,
              sourceState: matchupResult.cacheStatus === 'stale' ? 'stale' : 'fresh_server',
              cacheHit: false,
              cachedAt: String(response.data?.cachedAt || new Date().toISOString()),
              updatedAt: String(response.data?.updatedAt || new Date().toISOString()),
            }
          : row
      );

    matchupPlayerSummaryCache.set(matchupSummaryKey, {
      ...matchupSummary,
      updatedAt: String(response.data?.updatedAt || new Date().toISOString()),
      summaries: {
        home: updateSummaryPlayer(matchupSummary.summaries.home || []),
        away: updateSummaryPlayer(matchupSummary.summaries.away || []),
      },
    });
  }

  playerPredictionCache.set(cacheKey, {
    key: cacheKey,
    data: response.data,
    source: response.source,
    sourceHealth: response.sourceHealth,
    cacheStatus: response.cacheStatus,
    warning: response.warning,
    errorCode: response.errorCode,
    cachedAt: String(response.data?.cachedAt || new Date().toISOString()),
  });

  return response;
}
