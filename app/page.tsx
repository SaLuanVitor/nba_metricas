'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from "@/components/stat-card"
import { TopPlayersList } from "@/components/top-players-list"
import { TrendingPlayers } from "@/components/trending-players"
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar, TeamLogo } from "@/components/entity-media"
import { Users, Trophy, Activity, Target, Clock, Play, Calendar, ExternalLink, TrendingUp } from "lucide-react"

export default function Dashboard() {
  const [data, setData] = useState({
    players: [] as any[],
    games: [] as any[],
    lastUpdate: null as Date | null,
    source: '',
    queryDate: '',
    gameDate: '',
    timezone: 'America/Bahia',
    sourceHealth: 'degraded' as 'ok' | 'degraded',
  });
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [errorStreak, setErrorStreak] = useState(0);

  const liveGamesCount = data.games.filter((g: any) => isGameLive(g)).length;
  const pollIntervalMs = useMemo(() => {
    const hasLive = liveGamesCount > 0;
    const base = data.sourceHealth === 'degraded'
      ? (hasLive ? 60_000 : 120_000)
      : (hasLive ? 30_000 : 60_000);
    const backoffMultiplier = Math.min(4, Math.max(1, errorStreak + 1));
    return base * backoffMultiplier;
  }, [data.sourceHealth, liveGamesCount, errorStreak]);

  const fetchData = useCallback(async () => {
    try {
      const [playersRes, gamesRes] = await Promise.all([
        fetch('/api/players', { cache: 'no-store' }),
        fetch('/api/games/today', { cache: 'no-store' }),
      ]);

      const playersData = playersRes.ok ? await playersRes.json() : null;
      const gamesData = gamesRes.ok ? await gamesRes.json() : null;

      setData((prev) => {
        const nextPlayers = (playersData?.data?.length || 0) > 0
          ? playersData.data
          : prev.players;

        return {
          players: nextPlayers,
          games: gamesData?.data || [],
          lastUpdate: new Date(),
          source: playersData?.source || gamesData?.source || 'none',
          queryDate: gamesData?.date || '',
          gameDate: gamesData?.date || '',
          timezone: gamesData?.timezone || prev.timezone || 'America/Bahia',
          sourceHealth: playersData?.sourceHealth || 'degraded',
        };
      });
      setErrorStreak(0);
    } catch (err) {
      console.error("Error fetching data", err);
      setData(prev => ({ ...prev, sourceHealth: 'degraded' }));
      setErrorStreak((prev) => Math.min(prev + 1, 4));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void fetchData();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchData();
      }
    };

    const interval = setInterval(tick, pollIntervalMs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchData, pollIntervalMs]);

  const { players, games, lastUpdate, source, sourceHealth, timezone } = data;
  
  const avgProjectedPoints = players.length > 0
    ? (players.reduce((acc: number, p: any) => acc + (p.projection?.projectedPoints || p.seasonStats?.points || 0), 0) / players.length).toFixed(1)
    : "0.0";
  
  const liveGamesCountDisplay = games.filter((g: any) => isGameLive(g)).length;
  const scheduledGamesCount = games.filter((g: any) => isGameScheduled(g)).length;
  const finishedGamesCount = games.filter((g: any) => isGameFinished(g)).length;
  const trendingUpCount = players.filter((p: any) => p.projection?.trend === 'up').length;
  const todayGameTeamAbbrs = useMemo(() => {
    const set = new Set<string>();
    for (const game of games) {
      if (!(isGameLive(game) || isGameScheduled(game))) continue;
      const homeAbbr = String(game?.homeTeam?.abbreviation || game?.HOME_TEAM?.TEAM_ABBREVIATION || '').toUpperCase();
      const awayAbbr = String(game?.awayTeam?.abbreviation || game?.AWAY_TEAM?.TEAM_ABBREVIATION || '').toUpperCase();
      if (homeAbbr) set.add(homeAbbr);
      if (awayAbbr) set.add(awayAbbr);
    }
    return set;
  }, [games]);

  const todayProjectedPlayers = useMemo(() => {
    const hasTodayTeams = todayGameTeamAbbrs.size > 0;
    const base = hasTodayTeams
      ? players.filter((p: any) => todayGameTeamAbbrs.has(String(p?.team?.abbreviation || '').toUpperCase()))
      : players;

    return [...base].sort(
      (a: any, b: any) => Number(b?.projection?.projectedPoints || 0) - Number(a?.projection?.projectedPoints || 0)
    );
  }, [players, todayGameTeamAbbrs]);

  const todayHotPlayers = useMemo(() => {
    return todayProjectedPlayers
      .filter((p: any) => p?.projection?.trend === 'up')
      .sort((a: any, b: any) => Number(b?.projection?.confidence || 0) - Number(a?.projection?.confidence || 0));
  }, [todayProjectedPlayers]);

  const todayTeamOptions = useMemo(() => {
    return Array.from(
      new Set(
        todayProjectedPlayers
          .map((p: any) => String(p?.team?.abbreviation || '').toUpperCase())
          .filter(Boolean)
      )
    ).sort();
  }, [todayProjectedPlayers]);

  const todayPositionOptions = useMemo(() => {
    return Array.from(
      new Set(
        todayProjectedPlayers
          .map((p: any) => String(p?.position || '').toUpperCase())
          .filter(Boolean)
      )
    ).sort();
  }, [todayProjectedPlayers]);

  const todayProjectedPlayersFiltered = useMemo(() => {
    return todayProjectedPlayers.filter((p: any) => {
      const teamOk = teamFilter === 'all' || String(p?.team?.abbreviation || '').toUpperCase() === teamFilter;
      const positionOk = positionFilter === 'all' || String(p?.position || '').toUpperCase() === positionFilter;
      return teamOk && positionOk;
    });
  }, [todayProjectedPlayers, teamFilter, positionFilter]);

  useEffect(() => {
    if (teamFilter !== 'all' && !todayTeamOptions.includes(teamFilter)) {
      setTeamFilter('all');
    }
  }, [teamFilter, todayTeamOptions]);

  useEffect(() => {
    if (positionFilter !== 'all' && !todayPositionOptions.includes(positionFilter)) {
      setPositionFilter('all');
    }
  }, [positionFilter, todayPositionOptions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Carregando dados reais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">NBA Dashboard</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Dados em tempo real • Fonte: {source} {sourceHealth === 'degraded' ? '(degradada)' : ''}
          </p>
        </div>
        {lastUpdate && (
          <div className="text-sm text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleString('pt-BR', { timeZone: timezone })} ({timezone})
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Jogadores"
          value={players.length}
          subtitle="analisados"
          icon={Users}
        />
        <StatCard
          title="Média Proj. IA"
          value={avgProjectedPoints}
          subtitle="pontos"
          trend="up"
          trendValue="+IA"
          icon={Target}
        />
        <StatCard
          title="Programados"
          value={scheduledGamesCount}
          subtitle="por jogar"
          icon={Calendar}
        />
        <StatCard
          title="Finalizados"
          value={finishedGamesCount}
          subtitle="hoje"
          icon={Trophy}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 bg-card">
          <h2 className="text-base font-semibold mb-1">Jogadores em alta hoje</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Tendência de alta entre os jogos ao vivo e programados do dia.
          </p>
          {!todayHotPlayers.length && (
            <p className="text-sm text-muted-foreground">Sem jogadores em alta identificados no momento.</p>
          )}
          <div className="space-y-2">
            {todayHotPlayers.slice(0, 8).map((player: any) => (
              <div key={player.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar
                    src={player.imageUrl}
                    name={player.name}
                    initials={`${player.firstName?.[0] || player.name?.[0] || 'P'}${player.lastName?.[0] || ''}`}
                    className="h-10 w-10 rounded-full border bg-white object-cover"
                  />
                  <div>
                    <div className="font-medium text-sm">{player.name}</div>
                    <div className="text-xs text-muted-foreground">{player.team?.abbreviation || '-'} • {player.position || '-'}</div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{Number(player.projection?.projectedPoints || 0).toFixed(1)} pts</div>
                  <div className="text-xs text-green-500 inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {Number(player.projection?.confidence || 0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4 bg-card">
          <h2 className="text-base font-semibold mb-1">Projeções dos jogadores de hoje</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Todos os jogadores dos confrontos de hoje (ao vivo e programados).
          </p>
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos os times</option>
              {todayTeamOptions.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todas as posições</option>
              {todayPositionOptions.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </div>
          {!todayProjectedPlayersFiltered.length && (
            <p className="text-sm text-muted-foreground">Sem projeções disponíveis para os jogos do dia.</p>
          )}
          <div className="max-h-[360px] overflow-auto space-y-2 pr-1">
            {todayProjectedPlayersFiltered.map((player: any) => (
              <div key={player.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar
                    src={player.imageUrl}
                    name={player.name}
                    initials={`${player.firstName?.[0] || player.name?.[0] || 'P'}${player.lastName?.[0] || ''}`}
                    className="h-10 w-10 rounded-full border bg-white object-cover"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{player.name}</div>
                    <div className="text-xs text-muted-foreground">{player.team?.abbreviation || '-'} • {player.position || '-'}</div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{Number(player.projection?.projectedPoints || 0).toFixed(1)} pts</div>
                  <div className="text-xs text-muted-foreground">
                    AST {Number(player.projection?.projectedAssists || 0).toFixed(1)} • REB {Number(player.projection?.projectedRebounds || 0).toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-card">
        <h2 className="text-base font-semibold mb-1">O que isso significa</h2>
        <p className="text-sm text-muted-foreground">
          Este painel mostra sinais do momento. Quando a saúde da fonte estiver degradada, os números podem ficar parciais e mudar rapidamente.
        </p>
      </div>

      {sourceHealth === "degraded" && (
        <OperationalAlert
          title="Dados parciais no momento"
          message="Algumas fontes externas estão instáveis. Continuamos exibindo o melhor snapshot disponível."
        />
      )}

      {liveGamesCountDisplay > 0 && (
        <div className="border border-green-500/50 rounded-lg p-4 bg-green-900/10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500 animate-pulse" />
            Ao Vivo Agora
          </h2>
          <div className="space-y-3">
            {games.filter((g: any) => isGameLive(g)).map((game: any) => (
              <GameCard key={game.gameId || game.id} game={game} />
            ))}
          </div>
        </div>
      )}

      {scheduledGamesCount > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Jogos Programados
          </h2>
          <div className="space-y-3">
            {games.filter((g: any) => isGameScheduled(g)).map((game: any) => (
              <GameCard key={game.gameId || game.id} game={game} />
            ))}
          </div>
        </div>
      )}

      {finishedGamesCount > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Jogos Finalizados
          </h2>
          <div className="space-y-3">
            {games.filter((g: any) => isGameFinished(g)).map((game: any) => (
              <GameCard key={game.gameId || game.id} game={game} />
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopPlayersList players={players} />
        </div>
        <div className="space-y-6">
          <TrendingPlayers players={players} />
        </div>
      </div>
    </div>
  )
}

function isGameLive(game: any): boolean {
  const status = game.status || game.GameStatus;
  return status === 'live' || status === 2;
}

function isGameScheduled(game: any): boolean {
  const status = game.status || game.GameStatus;
  return status === 'scheduled' || status === 1;
}

function isGameFinished(game: any): boolean {
  const status = game.status || game.GameStatus;
  return status === 'final' || status === 3;
}

function GameCard({ game }: { game: any }) {
  const homeTeam = game.homeTeam?.abbreviation || game.HOME_TEAM?.TEAM_ABBREVIATION || 'HOME';
  const awayTeam = game.awayTeam?.abbreviation || game.AWAY_TEAM?.TEAM_ABBREVIATION || 'AWAY';
  const homeTeamLogo = game.homeTeam?.logoUrl || game.HOME_TEAM?.logoUrl || "";
  const awayTeamLogo = game.awayTeam?.logoUrl || game.AWAY_TEAM?.logoUrl || "";
  const homeScore = game.homeScore || game.HOME_SCORE || 0;
  const awayScore = game.awayScore || game.AWAY_SCORE || 0;
  const status = game.status || game.GameStatus;
  const gameTime = game.gameTime || game.GAME_TIME || '';
  const gameDate = game.date || game.GAME_DATE || '';
  const gameEndTime = game.gameEndTime || game.GAME_END_TIME || '';
  const period = game.period || game.PERIOD || '';
  const clock = game.clock || game.CLOCK || '';
  const watchUrl = game.watchUrl || game.WATCH_URL || '';
  
  const formattedDate = gameDate ? new Date(gameDate).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  
  const isLive = isGameLive(game);
  const isFinished = isGameFinished(game);
  const isScheduled = isGameScheduled(game);
  
  const getStatusDisplay = () => {
    if (isLive) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-green-500 font-bold text-lg animate-pulse">AO VIVO</span>
          <span className="text-xs text-green-400">
            {period ? `Q${period}` : ''} {clock ? ` - ${clock}` : ''}
          </span>
        </div>
      );
    }
    if (isFinished) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground font-bold text-lg">FINAL</span>
          {gameEndTime && (
            <span className="text-xs text-muted-foreground">
              Término: {gameEndTime}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <div className="text-lg font-bold">{gameTime || '--:--'}</div>
        <div className="text-xs text-muted-foreground">{formattedDate}</div>
      </div>
    );
  };
  
  return (
    <div className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-lg ${
      isLive ? 'bg-green-900/20 border border-green-500/50' :
      isFinished ? 'bg-muted/30' : 'bg-card'
    }`}>
      <div className="flex items-center gap-4 md:w-1/3">
        <div className="flex-1 text-right">
          <div className="inline-flex items-center gap-2">
            <TeamLogo src={awayTeamLogo} abbreviation={awayTeam} className="h-9 w-9 rounded bg-white p-0.5 object-contain" />
            <span className={`text-xl font-bold ${isLive ? 'text-green-400' : ''}`}>{awayTeam}</span>
          </div>
        </div>
        {isLive && (
          <span className="text-green-500 text-2xl font-bold">{awayScore}</span>
        )}
        {isFinished && (
          <span className="text-xl font-bold">{awayScore}</span>
        )}
      </div>
      
      <div className="flex-1 md:flex-none py-2 md:py-0">
        {getStatusDisplay()}
      </div>
      
      <div className="flex items-center gap-4 md:w-1/3">
        {isLive && (
          <span className="text-green-500 text-2xl font-bold">{homeScore}</span>
        )}
        {isFinished && (
          <span className="text-xl font-bold">{homeScore}</span>
        )}
        <div className="flex-1">
          <div className="inline-flex items-center gap-2">
            <TeamLogo src={homeTeamLogo} abbreviation={homeTeam} className="h-9 w-9 rounded bg-white p-0.5 object-contain" />
            <span className={`text-xl font-bold ${isLive ? 'text-green-400' : ''}`}>{homeTeam}</span>
          </div>
        </div>
      </div>

      {(isLive || isScheduled) && watchUrl && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 md:mt-0 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
        >
          Assistir Agora
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}


