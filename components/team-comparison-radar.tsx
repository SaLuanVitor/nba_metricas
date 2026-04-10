"use client"

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { TeamWithStats } from "@/lib/types"

interface TeamComparisonRadarProps {
  team1: TeamWithStats
  team2: TeamWithStats
}

export function TeamComparisonRadar({ team1, team2 }: TeamComparisonRadarProps) {
  // Normalizar valores para escala 0-100 para melhor visualizacao
  const normalize = (value: number, min: number, max: number) => {
    return Math.round(((value - min) / (max - min)) * 100)
  }

  const data = [
    {
      stat: "Pontos",
      [team1.abbreviation]: normalize(team1.stats.pointsPerGame, 100, 130),
      [team2.abbreviation]: normalize(team2.stats.pointsPerGame, 100, 130),
      fullMark: 100,
    },
    {
      stat: "Assistencias",
      [team1.abbreviation]: normalize(team1.stats.assistsPerGame, 20, 35),
      [team2.abbreviation]: normalize(team2.stats.assistsPerGame, 20, 35),
      fullMark: 100,
    },
    {
      stat: "Rebotes",
      [team1.abbreviation]: normalize(team1.stats.reboundsPerGame, 38, 50),
      [team2.abbreviation]: normalize(team2.stats.reboundsPerGame, 38, 50),
      fullMark: 100,
    },
    {
      stat: "Defesa",
      // Para defesa, menor é melhor, então invertemos
      [team1.abbreviation]: normalize(125 - team1.stats.defensiveRating, 0, 20),
      [team2.abbreviation]: normalize(125 - team2.stats.defensiveRating, 0, 20),
      fullMark: 100,
    },
    {
      stat: "Ataque",
      [team1.abbreviation]: normalize(team1.stats.offensiveRating, 105, 125),
      [team2.abbreviation]: normalize(team2.stats.offensiveRating, 105, 125),
      fullMark: 100,
    },
    {
      stat: "3P%",
      [team1.abbreviation]: normalize(team1.stats.threePointPercentage, 32, 42),
      [team2.abbreviation]: normalize(team2.stats.threePointPercentage, 32, 42),
      fullMark: 100,
    },
  ]

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          />
          <Radar
            name={`${team1.city} ${team1.name}`}
            dataKey={team1.abbreviation}
            stroke={team1.primaryColor}
            fill={team1.primaryColor}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Radar
            name={`${team2.city} ${team2.name}`}
            dataKey={team2.abbreviation}
            stroke={team2.primaryColor}
            fill={team2.primaryColor}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
