'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TeamLogo } from "@/components/entity-media"
import { cn } from "@/lib/utils"

interface Game {
  id: string
  gameId: string
  status: string
  date: string
  gameTime?: string
  homeTeam: {
    id: string
    abbreviation: string
    logoUrl?: string
    name: string
    city: string
  }
  awayTeam: {
    id: string
    abbreviation: string
    logoUrl?: string
    name: string
    city: string
  }
  homeScore: number
  awayScore: number
  venue?: string
}

export function LiveGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch('/api/games/today')
        const data = await res.json()
        
        if (!data.success) {
          throw new Error(data.error || 'API failed')
        }
        
        setGames(data.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
    const interval = setInterval(fetchGames, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Jogos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Jogos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-sm">Erro: {error}</div>
        </CardContent>
      </Card>
    )
  }

  const liveGames = games.filter((g) => g.status === 'live')
  const scheduledGames = games.filter((g) => g.status === 'scheduled' || g.status === 'final')
  const displayGames = [...liveGames, ...scheduledGames].slice(0, 4)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          Jogos
          {liveGames.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {liveGames.length} ao vivo
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayGames.length === 0 ? (
          <div className="text-muted-foreground text-sm">Nenhum jogo hoje</div>
        ) : (
          displayGames.map((game) => {
            return (
              <div
                key={game.id}
                className={cn(
                  "p-4 rounded-lg border",
                  game.status === "live"
                    ? "border-red-500/50 bg-red-500/5"
                    : "border-border bg-secondary/30"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">
                    {game.venue || game.homeTeam.name}
                  </span>
                  {game.status === "live" ? (
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      AO VIVO
                    </Badge>
                  ) : game.status === "final" ? (
                    <Badge variant="outline" className="text-xs">FINAL</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{game.gameTime}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TeamLogo
                        src={game.awayTeam.logoUrl}
                        abbreviation={game.awayTeam.abbreviation}
                        className="w-9 h-9 rounded-full border bg-white p-0.5 object-contain"
                        title={game.awayTeam.name}
                      />
                      <span className="font-medium text-foreground">
                        {game.awayTeam.city} {game.awayTeam.name}
                      </span>
                    </div>
                    {game.status === "live" && (
                      <span className="text-lg font-bold text-foreground">
                        {game.awayScore}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TeamLogo
                        src={game.homeTeam.logoUrl}
                        abbreviation={game.homeTeam.abbreviation}
                        className="w-9 h-9 rounded-full border bg-white p-0.5 object-contain"
                        title={game.homeTeam.name}
                      />
                      <span className="font-medium text-foreground">
                        {game.homeTeam.city} {game.homeTeam.name}
                      </span>
                    </div>
                    {game.status === "live" && (
                      <span className="text-lg font-bold text-foreground">
                        {game.homeScore}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
