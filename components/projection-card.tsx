import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { PlayerProjection } from "@/lib/types"
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react"

type ProjectionCardProps = {
  projection: PlayerProjection
  seasonStats: {
    points: number
    assists: number
    rebounds: number
    minutes: number
  }
}

export function ProjectionCard({ projection, seasonStats }: ProjectionCardProps) {
  const TrendIcon = 
    projection.trend === "up" ? TrendingUp : 
    projection.trend === "down" ? TrendingDown : 
    Minus

  const stats = [
    {
      label: "Pontos",
      projected: projection.projectedPoints,
      season: seasonStats.points,
      diff: projection.projectedPoints - seasonStats.points,
    },
    {
      label: "Assistencias",
      projected: projection.projectedAssists,
      season: seasonStats.assists,
      diff: projection.projectedAssists - seasonStats.assists,
    },
    {
      label: "Rebotes",
      projected: projection.projectedRebounds,
      season: seasonStats.rebounds,
      diff: projection.projectedRebounds - seasonStats.rebounds,
    },
    {
      label: "Minutos",
      projected: projection.projectedMinutes,
      season: seasonStats.minutes,
      diff: projection.projectedMinutes - seasonStats.minutes,
    },
  ]

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Projecoes
          </CardTitle>
          <div className="flex items-center gap-2">
            <TrendIcon
              className={cn(
                "h-5 w-5",
                projection.trend === "up" && "text-green-500",
                projection.trend === "down" && "text-red-500",
                projection.trend === "stable" && "text-muted-foreground"
              )}
            />
            <span className="text-sm text-muted-foreground">
              Confianca: {projection.confidence}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{stat.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {stat.projected.toFixed(1)}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    stat.diff > 0 && "text-green-500",
                    stat.diff < 0 && "text-red-500",
                    stat.diff === 0 && "text-muted-foreground"
                  )}
                >
                  ({stat.diff > 0 ? "+" : ""}{stat.diff.toFixed(1)})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={(stat.projected / (stat.season * 1.5)) * 100}
                className="h-2 bg-secondary"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Media da temporada: {stat.season.toFixed(1)}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Confianca do Modelo</span>
            <span className="text-sm font-medium text-foreground">{projection.confidence}%</span>
          </div>
          <Progress
            value={projection.confidence}
            className="h-2 mt-2 bg-secondary"
          />
        </div>
      </CardContent>
    </Card>
  )
}
