'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    name: string
    city: string
  }
  awayTeam: {
    id: string
    abbreviation: string
    name: string
    city: string
  }
  homeScore: number
  awayScore: number
  venue?: string
}

const teamColors: Record<string, string> = {
  lal: '#552583', gsw: '#1D428A', bos: '#007A33', mia: '#98002E',
  nyk: '#006BB6', bkn: '#000000', phi: '#006BB6', tor: '#CE1141',
  chi: '#CE1141', cle: '#860038', det: '#002D62', ind: '#002D62',
  mil: '#00471B', atl: '#E31837', cha: '#00788C', was: '#002B5C',
  dal: '#00538C', hou: '#CE1141', mem: '#12173F', nop: '#00788C',
  phx: '#1D1160', sac: '#5A2D81', lac: '#C8102E', den: '#FDB927',
  min: '#0C2340', okc: '#EF3B24', por: '#000000', sas: '#C4CED4',
  uta: '#002B5C'
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
            const homeColor = teamColors[game.homeTeam.id] || '#333'
            const awayColor = teamColors[game.awayTeam.id] || '#333'
            
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
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: awayColor }}
                      >
                        {game.awayTeam.abbreviation[0]}
                      </div>
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
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: homeColor }}
                      >
                        {game.homeTeam.abbreviation[0]}
                      </div>
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
