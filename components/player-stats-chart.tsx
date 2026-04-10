"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import type { PlayerStats } from "@/lib/types"

type PlayerStatsChartProps = {
  last5Games: PlayerStats[]
  title?: string
}

const chartConfig = {
  points: {
    label: "Pontos",
    color: "var(--chart-1)",
  },
  assists: {
    label: "Assistencias",
    color: "var(--chart-2)",
  },
  rebounds: {
    label: "Rebotes",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function PlayerStatsChart({ last5Games, title = "Ultimos 5 Jogos" }: PlayerStatsChartProps) {
  const data = last5Games.map((game, index) => ({
    game: `Jogo ${index + 1}`,
    points: game.points,
    assists: game.assists,
    rebounds: game.rebounds,
  }))

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="game"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="points"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-1)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="assists"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-2)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="rebounds"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-3)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
