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
                    {team.stats.wins}-{team.stats.losses}
                  </p>
                  <p className="text-xs text-muted-foreground">Record</p>
                </div>
                <div className="bg-secondary/50 rounded-md p-2">
                  <p className="text-lg font-bold text-foreground">
                    {team.stats.pointsPerGame.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">PPG</p>
                </div>
                <div className="bg-secondary/50 rounded-md p-2">
                  <p className="text-lg font-bold text-primary">
                    {team.streak}
                  </p>
                  <p className="text-xs text-muted-foreground">Streak</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ultimos 5:</span>
                <div className="flex gap-1">
                  {team.lastGames.map((result, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-5 w-5 rounded text-xs flex items-center justify-center font-medium",
                        result === "W"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      )}
                    >
                      {result}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )})}
    </div>
  )
}
