import { notFound } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlayerStatsChart } from "@/components/player-stats-chart"
import { ProjectionCard } from "@/components/projection-card"
import { ArrowLeft, AlertCircle, DollarSign, Zap } from "lucide-react"
import type { Player } from "@/lib/types"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host")
  const protocol = h.get("x-forwarded-proto") || "http"
  const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000")

  const response = await fetch(`${baseUrl}/api/players/${id}`, { cache: "no-store" })
  const payload = await response.json()
  const player = payload?.data as Player | null

  if (!player) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/players">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar para jogadores
        </Button>
      </Link>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-foreground shrink-0"
          style={{ backgroundColor: player.team.primaryColor + "33" }}
        >
          {player.firstName[0]}{player.lastName[0]}
        </div>

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
              style={{ borderColor: player.team.primaryColor }}
            >
              {player.team.city} {player.team.name}
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
                {player.fantasyPoints.toFixed(1)}
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
                ${(player.salary / 1000).toFixed(1)}K
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
                  {player.seasonStats.points.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Pontos</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {player.seasonStats.assists.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Assistencias</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {player.seasonStats.rebounds.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Rebotes</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">
                  {player.seasonStats.minutes.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Minutos</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.fieldGoalPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">FG%</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.threePointPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">3P%</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.freeThrowPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">FT%</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.steals.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Roubos</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.blocks.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Bloqueios</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">
                  {player.seasonStats.turnovers.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">Turnovers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projections */}
        <ProjectionCard
          projection={player.projection}
          seasonStats={{
            points: player.seasonStats.points,
            assists: player.seasonStats.assists,
            rebounds: player.seasonStats.rebounds,
            minutes: player.seasonStats.minutes,
          }}
        />
      </div>

      {/* Performance Chart */}
      <PlayerStatsChart last5Games={player.last5Games} />

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
