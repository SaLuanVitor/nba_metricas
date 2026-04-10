import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Player } from "@/lib/types"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type ComparisonTableProps = {
  player1: Player
  player2: Player
}

type StatRow = {
  label: string
  value1: number
  value2: number
  format?: "decimal" | "percentage" | "currency"
  higherIsBetter?: boolean
}

export function ComparisonTable({ player1, player2 }: ComparisonTableProps) {
  const stats: StatRow[] = [
    // Projections
    { label: "Pts Projetados", value1: player1.projection.projectedPoints, value2: player2.projection.projectedPoints },
    { label: "Ast Projetadas", value1: player1.projection.projectedAssists, value2: player2.projection.projectedAssists },
    { label: "Reb Projetados", value1: player1.projection.projectedRebounds, value2: player2.projection.projectedRebounds },
    { label: "Min Projetados", value1: player1.projection.projectedMinutes, value2: player2.projection.projectedMinutes },
    // Season Stats
    { label: "Pts (Temporada)", value1: player1.seasonStats.points, value2: player2.seasonStats.points },
    { label: "Ast (Temporada)", value1: player1.seasonStats.assists, value2: player2.seasonStats.assists },
    { label: "Reb (Temporada)", value1: player1.seasonStats.rebounds, value2: player2.seasonStats.rebounds },
    { label: "Min (Temporada)", value1: player1.seasonStats.minutes, value2: player2.seasonStats.minutes },
    // Efficiency
    { label: "FG%", value1: player1.seasonStats.fieldGoalPercentage, value2: player2.seasonStats.fieldGoalPercentage, format: "percentage" },
    { label: "3P%", value1: player1.seasonStats.threePointPercentage, value2: player2.seasonStats.threePointPercentage, format: "percentage" },
    { label: "FT%", value1: player1.seasonStats.freeThrowPercentage, value2: player2.seasonStats.freeThrowPercentage, format: "percentage" },
    // Fantasy
    { label: "Fantasy Points", value1: player1.fantasyPoints, value2: player2.fantasyPoints },
    { label: "Salario", value1: player1.salary, value2: player2.salary, format: "currency", higherIsBetter: false },
    { label: "Confianca", value1: player1.projection.confidence, value2: player2.projection.confidence, format: "percentage" },
  ]

  const formatValue = (value: number, format?: string) => {
    switch (format) {
      case "percentage":
        return `${value.toFixed(1)}%`
      case "currency":
        return `$${(value / 1000).toFixed(1)}K`
      default:
        return value.toFixed(1)
    }
  }

  const getWinner = (row: StatRow): 1 | 2 | 0 => {
    if (row.value1 === row.value2) return 0
    const higherIsBetter = row.higherIsBetter !== false
    if (higherIsBetter) {
      return row.value1 > row.value2 ? 1 : 2
    } else {
      return row.value1 < row.value2 ? 1 : 2
    }
  }

  const TrendIcon = ({ player }: { player: Player }) => {
    if (player.projection.trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />
    if (player.projection.trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Comparacao Detalhada</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Player Headers */}
        <div className="grid grid-cols-3 gap-4 mb-6 pb-4 border-b border-border">
          <div />
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2"
              style={{ backgroundColor: player1.team.primaryColor + "33" }}
            >
              {player1.firstName[0]}{player1.lastName[0]}
            </div>
            <div className="font-medium text-foreground">{player1.name}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              {player1.team.abbreviation} <TrendIcon player={player1} />
            </div>
          </div>
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2"
              style={{ backgroundColor: player2.team.primaryColor + "33" }}
            >
              {player2.firstName[0]}{player2.lastName[0]}
            </div>
            <div className="font-medium text-foreground">{player2.name}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              {player2.team.abbreviation} <TrendIcon player={player2} />
            </div>
          </div>
        </div>

        {/* Stats Rows */}
        <div className="space-y-2">
          {stats.map((row) => {
            const winner = getWinner(row)
            return (
              <div
                key={row.label}
                className="grid grid-cols-3 gap-4 py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="text-sm text-muted-foreground flex items-center">
                  {row.label}
                </div>
                <div
                  className={cn(
                    "text-center font-medium",
                    winner === 1 ? "text-green-500" : "text-foreground"
                  )}
                >
                  {formatValue(row.value1, row.format)}
                </div>
                <div
                  className={cn(
                    "text-center font-medium",
                    winner === 2 ? "text-green-500" : "text-foreground"
                  )}
                >
                  {formatValue(row.value2, row.format)}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
