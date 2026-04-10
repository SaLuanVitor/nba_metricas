"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts"
import type { Player } from "@/lib/types"

type ComparisonRadarChartProps = {
  player1: Player
  player2: Player
}

export function ComparisonRadarChart({ player1, player2 }: ComparisonRadarChartProps) {
  // Normalize stats to 0-100 scale for radar chart
  const maxValues = {
    points: 40,
    assists: 12,
    rebounds: 15,
    minutes: 40,
    fantasyPoints: 70,
  }

  const data = [
    {
      stat: "Pontos",
      player1: (player1.projection.projectedPoints / maxValues.points) * 100,
      player2: (player2.projection.projectedPoints / maxValues.points) * 100,
    },
    {
      stat: "Assistencias",
      player1: (player1.projection.projectedAssists / maxValues.assists) * 100,
      player2: (player2.projection.projectedAssists / maxValues.assists) * 100,
    },
    {
      stat: "Rebotes",
      player1: (player1.projection.projectedRebounds / maxValues.rebounds) * 100,
      player2: (player2.projection.projectedRebounds / maxValues.rebounds) * 100,
    },
    {
      stat: "Minutos",
      player1: (player1.projection.projectedMinutes / maxValues.minutes) * 100,
      player2: (player2.projection.projectedMinutes / maxValues.minutes) * 100,
    },
    {
      stat: "FPTS",
      player1: (player1.fantasyPoints / maxValues.fantasyPoints) * 100,
      player2: (player2.fantasyPoints / maxValues.fantasyPoints) * 100,
    },
  ]

  const chartConfig = {
    player1: {
      label: player1.lastName,
      color: player1.team.primaryColor,
    },
    player2: {
      label: player2.lastName,
      color: player2.team.primaryColor,
    },
  } satisfies ChartConfig

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Comparacao de Projecoes</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="stat"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Radar
              name={player1.lastName}
              dataKey="player1"
              stroke={player1.team.primaryColor}
              fill={player1.team.primaryColor}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name={player2.lastName}
              dataKey="player2"
              stroke={player2.team.primaryColor}
              fill={player2.team.primaryColor}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ color: "var(--foreground)" }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
