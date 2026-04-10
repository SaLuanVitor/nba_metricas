import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlayerStatsChart } from "@/components/player-stats-chart"
import { ProjectionCard } from "@/components/projection-card"
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar, TeamLogo } from "@/components/entity-media"
import { ArrowLeft, AlertCircle, DollarSign, Zap } from "lucide-react"
import { getDataOrchestrator } from "@/lib/data-orchestrator"
import type { Player } from "@/lib/types"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params
  const season = process.env.NBA_SEASON
  let result: any = {
    source: "none",
    sourceHealth: "degraded",
    cacheStatus: "rejected",
    warning: "Falha ao carregar dados do jogador.",
    data: null,
  }
  let player: Player | null = null

  try {
    const orchestrator = getDataOrchestrator()
    result = await orchestrator.getPlayerById(id, season)
    player = result?.data as Player | null
  } catch (error) {
    console.error(`[PLAYER_DETAIL_LOAD_FAILED] id=${id}`, error)
  }

  if (!player) {
    notFound()
  }

  const firstName = String(player.firstName || "").trim()
  const lastName = String(player.lastName || "").trim()
  const initials = `${firstName[0] || player.name?.[0] || "P"}${lastName[0] || player.name?.split(" ")[1]?.[0] || ""}`.toUpperCase()
  const team = player.team || {
    id: "unknown",
    name: "NBA",
    abbreviation: "NBA",
    city: "",
    conference: "East" as const,
    division: "Unknown",
    primaryColor: "#1D428A",
    secondaryColor: "#C8102E",
  }
  const seasonStats = player.seasonStats || {
    points: 0,
    assists: 0,
    rebounds: 0,
    minutes: 0,
    fieldGoalPercentage: 0,
    threePointPercentage: 0,
    freeThrowPercentage: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  }
  const projection = player.projection || {
    projectedPoints: seasonStats.points,
    projectedAssists: seasonStats.assists,
    projectedRebounds: seasonStats.rebounds,
    projectedMinutes: seasonStats.minutes,
    confidence: 60,
    trend: "stable" as const,
  }
  const last5Games = Array.isArray(player.last5Games) ? player.last5Games : []
  const fantasyPoints = Number(player.fantasyPoints || 0)
  const salary = Number(player.salary || 0)
  const playerConfidence = Number(projection.confidence || 0)
  const riskLabel =
    result?.sourceHealth === "degraded"
      ? "Risco medio"
      : playerConfidence >= 75
        ? "Risco baixo"
        : playerConfidence >= 60
          ? "Risco medio"
          : "Risco alto"
  const summaryLabel =
    playerConfidence >= 75
      ? `${player.name} esta em cenario estavel agora.`
      : playerConfidence >= 60
        ? `${player.name} tem cenario moderado agora.`
        : `${player.name} esta em cenario volatil agora.`

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/players">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar para jogadores
        </Button>
      </Link>

      {(result?.sourceHealth === "degraded" || result?.warning) && (
        <OperationalAlert
          title="Dados parciais no momento"
          message={result?.warning || "Algumas fontes estao instaveis; os numeros podem oscilar."}
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
            <div className="text-xl font-semibold">{playerConfidence}%</div>
            <div className="text-muted-foreground">{riskLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transparencia de dados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div>Fonte: {result?.source || "none"}</div>
            <div>Saude: {result?.sourceHealth || "degraded"}</div>
            <div>Cache: {result?.cacheStatus || "rejected"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <PlayerAvatar
          src={player.imageUrl}
          name={player.name}
          initials={initials}
          className="w-24 h-24 rounded-full border bg-white object-cover shrink-0"
          loading="eager"
        />

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{player.name}</h1>
            {player.injury && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {player.injury.status}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
            <Badge 
              variant="outline" 
              className="border-border"
              style={{ borderColor: team.primaryColor }}
            >
              <TeamLogo
                src={team.logoUrl}
                abbreviation={team.abbreviation}
                className="mr-1 h-4 w-4 rounded-sm bg-white p-0.5 object-contain inline-block align-middle"
              />
              {team.city} {team.name}
            </Badge>
            <span>#{player.number}</span>
            <span>{player.position}</span>
            <span>{player.height}</span>
            <span>{player.weight} lbs</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{player.age} anos</span>
            <span>{player.experience} anos de experiencia</span>
            <span>{player.college}</span>
          </div>

          {player.injury && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">
                <span className="font-medium">Lesao:</span> {player.injury.description}
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4 shrink-0">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 px-4 pb-4 text-center">
              <div className="flex items-center gap-1 text-primary justify-center">
                <Zap className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">FPTS</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {fantasyPoints.toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 px-4 pb-4 text-center">
              <div className="flex items-center gap-1 text-green-500 justify-center">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">Salario</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                ${(salary / 1000).toFixed(1)}K
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Season Stats */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Estatisticas da Temporada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {seasonStats.points.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Pontos</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {seasonStats.assists.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Assistencias</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {seasonStats.rebounds.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Rebotes</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {seasonStats.minutes.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Minutos</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.fieldGoalPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">FG%</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.threePointPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">3P%</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.freeThrowPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">FT%</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.steals.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Roubos</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.blocks.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Bloqueios</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {seasonStats.turnovers.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Turnovers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projections */}
        <ProjectionCard
          projection={projection}
          seasonStats={{
            points: seasonStats.points,
            assists: seasonStats.assists,
            rebounds: seasonStats.rebounds,
            minutes: seasonStats.minutes,
          }}
        />
      </div>

      {/* Performance Chart */}
      <PlayerStatsChart last5Games={last5Games} />

      {/* Compare Button */}
      <div className="flex justify-center">
        <Link href={`/compare?players=${player.id}`}>
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            Comparar com outro jogador
          </Button>
        </Link>
      </div>
    </div>
  )
}
