import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Player } from "@/lib/types"
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react"

type PlayerCardProps = {
  player: Player
  showProjections?: boolean
  compact?: boolean
}

export function PlayerCard({ player, showProjections = true, compact = false }: PlayerCardProps) {
  const TrendIcon = 
    player.projection.trend === "up" ? TrendingUp : 
    player.projection.trend === "down" ? TrendingDown : 
    Minus

  return (
    <Link href={`/players/${player.id}`}>
      <Card className={cn(
        "bg-card border-border hover:border-primary/50 transition-colors cursor-pointer",
        compact ? "p-3" : ""
      )}>
        <CardContent className={cn("flex items-center gap-4", compact ? "p-0" : "pt-6")}>
          {/* Avatar placeholder */}
          <div 
            className={cn(
              "rounded-full bg-secondary flex items-center justify-center font-bold text-foreground",
              compact ? "h-10 w-10 text-sm" : "h-14 w-14 text-lg"
            )}
            style={{ backgroundColor: player.team.primaryColor + "33" }}
          >
            {player.firstName[0]}{player.lastName[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn("font-semibold text-foreground truncate", compact ? "text-sm" : "")}>
                {player.name}
              </h3>
              {player.injury && (
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{player.team.abbreviation}</span>
              <span>-</span>
              <span>{player.position}</span>
              {player.injury && (
                <Badge variant="destructive" className="text-xs">
                  {player.injury.status}
                </Badge>
              )}
            </div>
          </div>

          {showProjections && (
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 justify-end">
                <span className="text-lg font-bold text-foreground">
                  {player.projection.projectedPoints.toFixed(1)}
                </span>
                <TrendIcon 
                  className={cn(
                    "h-4 w-4",
                    player.projection.trend === "up" && "text-green-500",
                    player.projection.trend === "down" && "text-red-500",
                    player.projection.trend === "stable" && "text-muted-foreground"
                  )} 
                />
              </div>
              <span className="text-xs text-muted-foreground">PTS proj.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
