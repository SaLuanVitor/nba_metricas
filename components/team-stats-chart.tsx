"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { TeamWithStats } from "@/lib/types"

interface TeamStatsChartProps {
  team: TeamWithStats
}

export function TeamStatsChart({ team }: TeamStatsChartProps) {
  const data = [
    {
      name: "PPG",
      value: team.stats.pointsPerGame,
      avg: 112.5,
      label: "Pontos/Jogo",
    },
    {
      name: "APG",
      value: team.stats.assistsPerGame,
      avg: 25.2,
      label: "Assistencias/Jogo",
    },
    {
      name: "RPG",
      value: team.stats.reboundsPerGame,
      avg: 43.5,
      label: "Rebotes/Jogo",
    },
    {
      name: "SPG",
      value: team.stats.stealsPerGame,
      avg: 7.5,
      label: "Roubos/Jogo",
    },
    {
      name: "BPG",
      value: team.stats.blocksPerGame,
      avg: 5.0,
      label: "Tocos/Jogo",
    },
  ]

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number, _name: string, item: any) => {
              const label = item?.payload?.label || "Métrica"
              const avg = item?.payload?.avg ?? 0
              return [`${value.toFixed(1)} (Média NBA: ${avg})`, label]
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value > entry.avg ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
          <span className="text-muted-foreground">Acima da media</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
          <span className="text-muted-foreground">Abaixo da media</span>
        </div>
      </div>
    </div>
  )
}
