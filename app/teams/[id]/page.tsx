import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, TrendingUp, TrendingDown, Minus, GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"
import { TeamStatsChart } from "@/components/team-stats-chart"
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar, TeamLogo } from "@/components/entity-media"
import { getDataOrchestrator } from "@/lib/data-orchestrator"
import { buildFallbackTeamsFromPlayers } from "@/lib/nba/team-fallback"
import type { Player, TeamWithStats } from "@/lib/types"

interface TeamDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id } = await params
  const season = process.env.NBA_SEASON
  const orchestrator = getDataOrchestrator()
  const [teamsResult, rosterResult, playersResult] = await Promise.all([
    orchestrator.getTeams(season),
    orchestrator.getTeamRoster(id, season),
    orchestrator.getPlayers(season),
  ])
  const teamsFromFallback =
    (!teamsResult?.data || teamsResult.data.length === 0)
      ? buildFallbackTeamsFromPlayers(playersResult?.data || [])
      : []
  const availableTeams = (teamsResult?.data && teamsResult.data.length > 0)
    ? teamsResult.data
    : teamsFromFallback

  const team = (availableTeams || []).find(
    (t: TeamWithStats) =>
      String(t.id) === String(id) ||
      String(t.abbreviation || "").toLowerCase() === String(id || "").toLowerCase()
  )

  if (!team) {
    notFound()
  }

  const rosterFromTeam = Array.isArray(rosterResult?.data) ? rosterResult.data : []
  const rosterFromPlayers = (playersResult?.data || []).filter((p: Player) => {
    const byId = String(p.team?.id || "") === String(team.id)
    const byAbbr =
      String(p.team?.abbreviation || "").toLowerCase() ===
      String(team.abbreviation || "").toLowerCase()
    return byId || byAbbr
  })
  const rosterMap = new Map<string, Player>()
  for (const p of [...rosterFromTeam, ...rosterFromPlayers]) {
    if (p?.id) rosterMap.set(String(p.id), p)
  }
  const roster: Player[] = Array.from(rosterMap.values())
  const totals = roster.reduce(
    (acc: { points: number; assists: number; rebounds: number; minutes: number; fantasy: number }, player: Player) => ({
      points: acc.points + player.projection.projectedPoints,
      assists: acc.assists + player.projection.projectedAssists,
      rebounds: acc.rebounds + player.projection.projectedRebounds,
      minutes: acc.minutes + player.projection.projectedMinutes,
      fantasy: acc.fantasy + player.fantasyPoints,
    }),
    { points: 0, assists: 0, rebounds: 0, minutes: 0, fantasy: 0 }
  )
  const averages = {
    avgPoints: roster.length ? totals.points / roster.length : 0,
    avgAssists: roster.length ? totals.assists / roster.length : 0,
    avgRebounds: roster.length ? totals.rebounds / roster.length : 0,
    avgMinutes: roster.length ? totals.minutes / roster.length : 0,
    totalFantasyPoints: totals.fantasy,
  }

  const wins = Number(team.stats?.wins || 0)
  const losses = Number(team.stats?.losses || 0)
  const gamesPlayed = Number(team.record?.gamesPlayed ?? (wins + losses))
  const winPct = Number(team.record?.winPct ?? (gamesPlayed > 0 ? wins / gamesPlayed : 0))
  const last10 = String(team.record?.last10 || (() => {
    const games = Array.isArray(team.lastGames) ? team.lastGames.slice(-10) : []
    const winCount = games.filter((result: "W" | "L") => result === "W").length
    return `${winCount}-${Math.max(0, games.length - winCount)}`
  })())

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const source = teamsResult?.source !== "none"
    ? teamsResult?.source
    : rosterResult?.source !== "none"
      ? rosterResult?.source
      : playersResult?.source || "none"
  const sourceHealth =
    teamsResult?.sourceHealth === "ok" &&
    rosterResult?.sourceHealth === "ok" &&
    playersResult?.sourceHealth === "ok"
      ? "ok"
      : "degraded"
  const cacheStatus =
    teamsResult?.cacheStatus !== "rejected"
      ? teamsResult?.cacheStatus
      : rosterResult?.cacheStatus !== "rejected"
        ? rosterResult?.cacheStatus
        : playersResult?.cacheStatus || "rejected"
  const warning = teamsResult?.warning || rosterResult?.warning || playersResult?.warning
  const teamStrength = Number(team.stats?.offensiveRating || 0) - Number(team.stats?.defensiveRating || 0)
  const riskLabel =
    sourceHealth === "degraded"
      ? "Risco medio"
      : teamStrength >= 3
        ? "Risco baixo"
        : teamStrength >= 0
          ? "Risco medio"
          : "Risco alto"
  const summaryLabel =
    teamStrength >= 3
      ? `${team.city} ${team.name} chega com boa vantagem tecnica.`
      : teamStrength >= 0
        ? `${team.city} ${team.name} chega em cenario equilibrado.`
        : `${team.city} ${team.name} chega em cenario de risco.`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <TeamLogo
            src={team.logoUrl}
            abbreviation={team.abbreviation}
            className="h-24 w-24 rounded-xl border bg-white p-1.5 object-contain"
            loading="eager"
          />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {team.city} {team.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{team.conference}ern Conference</Badge>
              <Badge variant="outline">{team.division}</Badge>
              <span className="text-muted-foreground">
                #{team.rank.conference} na conferencia
              </span>
            </div>
          </div>
        </div>
      </div>

      {(sourceHealth === "degraded" || warning) && (
        <OperationalAlert
          title="Dados parciais no momento"
          message={warning || "Algumas fontes estao instaveis; os numeros podem oscilar."}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo para cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{summaryLabel}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risco da leitura</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-xl font-semibold">{riskLabel}</div>
            <div className="text-muted-foreground">Baseado em saude da fonte e forca tecnica atual.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transparencia de dados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div>Fonte: {source || "none"}</div>
            <div>Saude: {sourceHealth}</div>
            <div>Cache: {cacheStatus}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{wins}</p>
            <p className="text-xs text-muted-foreground">Vitorias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{losses}</p>
            <p className="text-xs text-muted-foreground">Derrotas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{(winPct * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Win%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{last10}</p>
            <p className="text-xs text-muted-foreground">Ultimos 10</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{team.stats.pointsPerGame.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Pontos/Jogo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{team.stats.assistsPerGame.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Assistencias/Jogo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{team.stats.reboundsPerGame.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Rebotes/Jogo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{team.stats.offensiveRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Off Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{team.stats.defensiveRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Def Rating</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Stats Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Estatisticas do Time</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamStatsChart team={team} />
          </CardContent>
        </Card>

        {/* Additional Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">FG%</span>
              <span className="font-semibold">{team.stats.fieldGoalPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">3P%</span>
              <span className="font-semibold">{team.stats.threePointPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">FT%</span>
              <span className="font-semibold">{team.stats.freeThrowPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Roubos/Jogo</span>
              <span className="font-semibold">{team.stats.stealsPerGame.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tocos/Jogo</span>
              <span className="font-semibold">{team.stats.blocksPerGame.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Turnovers/Jogo</span>
              <span className="font-semibold">{team.stats.turnoversPerGame.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pace</span>
              <span className="font-semibold">{team.stats.pace.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-muted-foreground">Sequencia</span>
              <span className={cn(
                "font-bold",
                team.streak.startsWith("W") ? "text-green-500" : "text-red-500"
              )}>
                {team.streak}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Roster */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Elenco ({roster.length} jogadores)</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Fantasy Total: </span>
            <span className="font-bold text-primary">{averages.totalFantasyPoints.toFixed(1)} pts</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogador</TableHead>
                  <TableHead className="text-center">Pos</TableHead>
                  <TableHead className="text-right">PTS Proj.</TableHead>
                  <TableHead className="text-right">AST Proj.</TableHead>
                  <TableHead className="text-right">REB Proj.</TableHead>
                  <TableHead className="text-right">MIN Proj.</TableHead>
                  <TableHead className="text-center">Tend.</TableHead>
                  <TableHead className="text-right">Fantasy</TableHead>
                  <TableHead className="text-center">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster
                  .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                  .map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <Link
                        href={`/players/${player.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <PlayerAvatar
                            src={player.imageUrl}
                            name={player.name}
                            initials={`${player.firstName?.[0] || "P"}${player.lastName?.[0] || ""}`}
                            className="h-12 w-12 rounded-full border bg-white object-cover"
                          />
                          <div>
                            <p className="font-medium">{player.name}</p>
                            {player.injury && (
                              <Badge variant="destructive" className="text-xs">
                                {player.injury.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{player.position}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {player.projection.projectedPoints.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {player.projection.projectedAssists.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {player.projection.projectedRebounds.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {player.projection.projectedMinutes.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getTrendIcon(player.projection.trend)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {player.fantasyPoints.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/compare?players=${player.id}`}>
                        <Button variant="ghost" size="sm">
                          <GitCompare className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {roster.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum jogador encontrado para este time
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
