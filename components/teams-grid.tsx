"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TeamWithStats } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TeamsGridProps {
  teams: TeamWithStats[]
}

export function TeamsGrid({ teams }: TeamsGridProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {teams.map((team, index) => {
        const teamId = team.id || team.abbreviation?.toLowerCase() || `team-${index}`
        const wins = Number(team.stats?.wins || 0)
        const losses = Number(team.stats?.losses || 0)
        const gamesPlayed = Number(team.record?.gamesPlayed ?? wins + losses)
        const winPct = Number(team.record?.winPct ?? (gamesPlayed > 0 ? wins / gamesPlayed : 0))
        const last10 = String(team.record?.last10 || (() => {
          const games = Array.isArray(team.lastGames) ? team.lastGames.slice(-10) : []
          const winCount = games.filter((result) => result === "W").length
          return `${winCount}-${Math.max(0, games.length - winCount)}`
        })())
        return (
        <Link key={`${teamId}-${index}`} href={`/teams/${teamId}`}>
          <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: team.primaryColor }}
                  >
                    {team.abbreviation}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{team.city}</h3>
                    <p className="text-sm text-muted-foreground">{team.name}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  #{team.rank.conference} {team.conference}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-secondary/50 rounded-md p-2">
                  <p className="text-lg font-bold text-foreground">
                    {wins}-{losses}
                  </p>
                  <p className="text-xs text-muted-foreground">W-L</p>
                </div>
                <div className="bg-secondary/50 rounded-md p-2">
                  <p className="text-lg font-bold text-foreground">
                    {(winPct * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Win%</p>
                </div>
                <div className="bg-secondary/50 rounded-md p-2">
                  <p className="text-lg font-bold text-primary">
                    {gamesPlayed}
                  </p>
                  <p className="text-xs text-muted-foreground">Jogos</p>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ultimos 10:</span>
                  <span className="font-medium">{last10}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Streak:</span>
                  <span
                    className={cn(
                      "font-medium",
                      String(team.streak || "").startsWith("W") ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {team.record?.streak || team.streak || "N0"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )})}
    </div>
  )
}
