'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayerCard } from "./player-card"
import { TrendingUp, AlertCircle } from "lucide-react"
import type { Player } from "@/lib/types"

interface Injury {
  playerId: string
  playerName: string
  team: string
  description: string
  status: string
}

interface TrendingPlayersProps {
  players?: Player[]
}

export function TrendingPlayers({ players: providedPlayers }: TrendingPlayersProps) {
  const [trending, setTrending] = useState<Player[]>([])
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(!providedPlayers)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        let playersData: { success: boolean; data: Player[]; error?: string } = {
          success: true,
          data: providedPlayers || [],
        }
        if (!providedPlayers) {
          const playersRes = await fetch('/api/players')
          playersData = await playersRes.json()
        }
        const injuriesRes = await fetch('/api/injuries')
        const injuriesData = await injuriesRes.json()

        if (!playersData.success) {
          throw new Error(playersData.error || 'Players API failed')
        }

        const sorted = (playersData.data || [])
          .sort((a: Player, b: Player) => 
            (b.projection?.projectedPoints || 0) - (a.projection?.projectedPoints || 0)
          )
          .slice(0, 3)

        setTrending(sorted)
        setInjuries(injuriesData.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [providedPlayers])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Em Alta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">Carregando...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Em Alta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-400 text-sm">Erro: {error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Em Alta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trending.length === 0 ? (
            <div className="text-muted-foreground">Nenhum jogador encontrado</div>
          ) : (
            trending.map((player) => (
              <PlayerCard key={player.id} player={player} compact />
            ))
          )}
        </CardContent>
      </Card>

      {injuries.length > 0 && (
        <Card className="bg-card border-border border-red-500/30">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Lesoes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {injuries.slice(0, 3).map((injury) => (
              <div key={injury.playerId} className="flex justify-between items-center p-2">
                <div>
                  <div className="font-medium text-foreground">{injury.playerName}</div>
                  <div className="text-xs text-muted-foreground">{injury.team}</div>
                </div>
                <div className="text-xs text-red-400">{injury.status}: {injury.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
