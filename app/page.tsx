'use client';
import { useEffect, useState } from 'react';
import { StatCard } from "@/components/stat-card"
import { TopPlayersList } from "@/components/top-players-list"
import { TrendingPlayers } from "@/components/trending-players"
import { Users, Trophy, Activity, Target, Clock, Play, Calendar } from "lucide-react"

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

  useEffect(() => {
    async function fetchData() {
      try {
        const [playersRes, gamesRes] = await Promise.all([
          fetch('/api/players', { cache: 'no-store' }),
          fetch('/api/games/today', { cache: 'no-store' })
        ]);

        // Check if responses are OK
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
      } catch (err) {
        console.error("Error fetching data", err);
        setData(prev => ({ ...prev, sourceHealth: 'degraded' }));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

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

  const { players, games, lastUpdate, source, sourceHealth, timezone } = data;
  
  const avgProjectedPoints = players.length > 0
    ? (players.reduce((acc: number, p: any) => acc + (p.projection?.projectedPoints || p.seasonStats?.points || 0), 0) / players.length).toFixed(1)
    : "0.0";
  
  const liveGamesCount = games.filter((g: any) => isGameLive(g)).length;
  const scheduledGamesCount = games.filter((g: any) => isGameScheduled(g)).length;
  const finishedGamesCount = games.filter((g: any) => isGameFinished(g)).length;
  const trendingUpCount = players.filter((p: any) => p.projection?.trend === 'up').length;

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

      {liveGamesCount > 0 && (
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
  const homeScore = game.homeScore || game.HOME_SCORE || 0;
  const awayScore = game.awayScore || game.AWAY_SCORE || 0;
  const status = game.status || game.GameStatus;
  const gameTime = game.gameTime || game.GAME_TIME || '';
  const gameDate = game.date || game.GAME_DATE || '';
  const gameEndTime = game.gameEndTime || game.GAME_END_TIME || '';
  const period = game.period || game.PERIOD || '';
  const clock = game.clock || game.CLOCK || '';
  
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
          <span className={`text-xl font-bold ${isLive ? 'text-green-400' : ''}`}>{awayTeam}</span>
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
          <span className={`text-xl font-bold ${isLive ? 'text-green-400' : ''}`}>{homeTeam}</span>
        </div>
      </div>
    </div>
  );
}


