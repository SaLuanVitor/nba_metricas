"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ComparisonRadarChart } from "@/components/comparison-radar-chart"
import { ComparisonTable } from "@/components/comparison-table"
import { GitCompare } from "lucide-react"
import type { Player } from "@/lib/types"

function CompareContent() {
  const searchParams = useSearchParams()
  const initialPlayer = searchParams.get("players")

  const [players, setPlayers] = useState<Player[]>([])
  const [player1Id, setPlayer1Id] = useState<string>(initialPlayer || "")
  const [player2Id, setPlayer2Id] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("/api/players")
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Falha ao carregar jogadores")
        }

        const list: Player[] = json.data || []
        setPlayers(list)

        if (!initialPlayer && list[0]) setPlayer1Id(list[0].id)
        if (initialPlayer) setPlayer1Id(initialPlayer)
        if (list[1]) setPlayer2Id(list[1].id)
      } catch (err: any) {
        setError(err.message || "Erro ao buscar jogadores")
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [initialPlayer])

  const player1 = players.find((p) => p.id === player1Id)
  const player2 = players.find((p) => p.id === player2Id)

  // Update player2 if it becomes the same as player1
  useEffect(() => {
    if (player1Id === player2Id) {
      const otherPlayer = players.find((p) => p.id !== player1Id)
      if (otherPlayer) {
        setPlayer2Id(otherPlayer.id)
      }
    }
  }, [player1Id, player2Id])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando jogadores...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!player1 || !player2) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Selecione dois jogadores para comparar</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Comparador de Jogadores
        </h1>
        <p className="text-muted-foreground mt-1">
          Compare estatisticas e projecoes entre dois jogadores
        </p>
      </div>

      {/* Player Selection */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Selecionar Jogadores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Jogador 1</label>
              <Select value={player1Id} onValueChange={setPlayer1Id}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem
                      key={player.id}
                      value={player.id}
                      disabled={player.id === player2Id}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: player.team.primaryColor + "33" }}
                        >
                          {player.firstName[0]}{player.lastName[0]}
                        </div>
                        <span>{player.name}</span>
                        <span className="text-muted-foreground">({player.team.abbreviation})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Jogador 2</label>
              <Select value={player2Id} onValueChange={setPlayer2Id}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem
                      key={player.id}
                      value={player.id}
                      disabled={player.id === player1Id}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: player.team.primaryColor + "33" }}
                        >
                          {player.firstName[0]}{player.lastName[0]}
                        </div>
                        <span>{player.name}</span>
                        <span className="text-muted-foreground">({player.team.abbreviation})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ComparisonRadarChart player1={player1} player2={player2} />
        <ComparisonTable player1={player1} player2={player2} />
      </div>

      {/* Quick Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-secondary/30">
              <h3 className="font-medium text-foreground mb-2">{player1.name}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Projecao de pontos: <span className="text-foreground font-medium">{player1.projection.projectedPoints.toFixed(1)}</span></li>
                <li>Fantasy Points: <span className="text-foreground font-medium">{player1.fantasyPoints.toFixed(1)}</span></li>
                <li>Confianca: <span className="text-foreground font-medium">{player1.projection.confidence}%</span></li>
                <li>Tendencia: <span className={player1.projection.trend === "up" ? "text-green-500" : player1.projection.trend === "down" ? "text-red-500" : "text-muted-foreground"}>{player1.projection.trend === "up" ? "Em alta" : player1.projection.trend === "down" ? "Em baixa" : "Estavel"}</span></li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <h3 className="font-medium text-foreground mb-2">{player2.name}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Projecao de pontos: <span className="text-foreground font-medium">{player2.projection.projectedPoints.toFixed(1)}</span></li>
                <li>Fantasy Points: <span className="text-foreground font-medium">{player2.fantasyPoints.toFixed(1)}</span></li>
                <li>Confianca: <span className="text-foreground font-medium">{player2.projection.confidence}%</span></li>
                <li>Tendencia: <span className={player2.projection.trend === "up" ? "text-green-500" : player2.projection.trend === "down" ? "text-red-500" : "text-muted-foreground"}>{player2.projection.trend === "up" ? "Em alta" : player2.projection.trend === "down" ? "Em baixa" : "Estavel"}</span></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
