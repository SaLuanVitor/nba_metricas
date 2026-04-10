"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlayerCard } from "./player-card"
import type { Player } from "@/lib/types"

type StatCategory = "points" | "assists" | "rebounds" | "minutes"

const categories: { value: StatCategory; label: string }[] = [
  { value: "points", label: "Pontos" },
  { value: "assists", label: "Assistencias" },
  { value: "rebounds", label: "Rebotes" },
  { value: "minutes", label: "Minutos" },
]

interface TopPlayersListProps {
  players?: Player[]
}

export function TopPlayersList({ players: providedPlayers }: TopPlayersListProps) {
  const [category, setCategory] = useState<StatCategory>("points")
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(!providedPlayers)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sortPlayers = (list: Player[]) => {
      return [...list].sort((a: Player, b: Player) => {
        switch (category) {
          case 'points':
            return (b.projection?.projectedPoints || 0) - (a.projection?.projectedPoints || 0)
          case 'assists':
            return (b.projection?.projectedAssists || 0) - (a.projection?.projectedAssists || 0)
          case 'rebounds':
            return (b.projection?.projectedRebounds || 0) - (a.projection?.projectedRebounds || 0)
          case 'minutes':
            return (b.projection?.projectedMinutes || 0) - (a.projection?.projectedMinutes || 0)
          default:
            return 0
        }
      }).slice(0, 5)
    }

    if (providedPlayers) {
      setPlayers(sortPlayers(providedPlayers))
      setLoading(false)
      return
    }

    async function fetchPlayers() {
      try {
        const res = await fetch('/api/players')
        const data = await res.json()
        
        if (!data.success) {
          throw new Error(data.error || 'API failed')
        }
        
        setPlayers(sortPlayers(data.data || []))
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [category, providedPlayers])

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Top Projecoes</CardTitle>
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
          <CardTitle className="text-foreground">Top Projecoes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Erro: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-foreground">Top Projecoes</CardTitle>
          <Tabs value={category} onValueChange={(v) => setCategory(v as StatCategory)}>
            <TabsList className="bg-secondary">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {players.length === 0 ? (
          <div className="text-muted-foreground">Nenhum jogador encontrado</div>
        ) : (
          players.map((player, index) => (
            <div key={player.id} className="flex items-center gap-3">
              <span className="w-6 text-sm font-medium text-muted-foreground">
                #{index + 1}
              </span>
              <div className="flex-1">
                <PlayerCard player={player} compact />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
