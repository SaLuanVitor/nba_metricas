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
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar } from "@/components/entity-media"
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
  const [apiMeta, setApiMeta] = useState<{ source?: string; sourceHealth?: string; cacheStatus?: string; warning?: string } | null>(null)

  const scorePlayer = (player: Player) =>
    Number(player.projection?.projectedPoints || 0) +
    Number(player.projection?.projectedAssists || 0) * 1.5 +
    Number(player.projection?.projectedRebounds || 0) * 1.2

  const getRiskLabel = (confidence: number) => {
    if (confidence >= 75) return "Risco baixo"
    if (confidence >= 60) return "Risco medio"
    return "Risco alto"
  }

  const confidenceLabel = (confidence: number) => {
    if (confidence >= 75) return "Alta confianca"
    if (confidence >= 60) return "Confianca moderada"
    return "Baixa confianca"
  }

  async function fetchPlayersData() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/players", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Falha ao carregar jogadores")
      }

      const list: Player[] = json.data || []
      setPlayers(list)
      setApiMeta({
        source: json.source,
        sourceHealth: json.sourceHealth,
        cacheStatus: json.cacheStatus,
        warning: json.warning,
      })

      if (!initialPlayer && list[0]) setPlayer1Id(list[0].id)
      if (initialPlayer) setPlayer1Id(initialPlayer)
      if (list[1]) setPlayer2Id(list[1].id)
    } catch (err: any) {
      setError(err.message || "Erro ao buscar jogadores")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlayersData()
  }, [initialPlayer])

  const player1 = players.find((p) => p.id === player1Id)
  const player2 = players.find((p) => p.id === player2Id)

  useEffect(() => {
    if (player1Id === player2Id) {
      const otherPlayer = players.find((p) => p.id !== player1Id)
      if (otherPlayer) setPlayer2Id(otherPlayer.id)
    }
  }, [player1Id, player2Id, players])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando jogadores...</p>
      </div>
    )
  }

  if (error) {
    return <OperationalAlert severity="error" title="Falha temporaria" message={error} onRetry={fetchPlayersData} />
  }

  if (!player1 || !player2) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Selecione dois jogadores para comparar</p>
      </div>
    )
  }

  const player1Score = scorePlayer(player1)
  const player2Score = scorePlayer(player2)
  const winner =
    Math.abs(player1Score - player2Score) < 1
      ? "Empate tecnico"
      : player1Score > player2Score
        ? player1.name
        : player2.name
  const avgConfidence = Math.round(
    (Number(player1.projection?.confidence || 60) + Number(player2.projection?.confidence || 60)) / 2
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Comparador de Jogadores
        </h1>
        <p className="text-muted-foreground mt-1">
          Compare estatisticas e projecoes entre dois jogadores
        </p>
      </div>

      {(apiMeta?.sourceHealth === "degraded" || apiMeta?.warning) && (
        <OperationalAlert
          title="Dados parciais no momento"
          message={apiMeta?.warning || "Algumas fontes estao instaveis; os numeros podem oscilar."}
          onRetry={fetchPlayersData}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo para cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Melhor agora: <span className="font-medium">{winner}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risco da analise</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-xl font-semibold">{avgConfidence}%</div>
            <div className="text-muted-foreground">{getRiskLabel(avgConfidence)}</div>
            <div className="text-xs text-muted-foreground mt-1">{confidenceLabel(avgConfidence)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transparencia de dados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div>Fonte: {apiMeta?.source || "none"}</div>
            <div>Saude: {apiMeta?.sourceHealth || "degraded"}</div>
            <div>Cache: {apiMeta?.cacheStatus || "rejected"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">O que isso significa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use esta comparacao como suporte de decisao. Se a confianca estiver baixa ou a fonte degradada, trate o resultado como cenario e nao como certeza.
        </CardContent>
      </Card>

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
                        <PlayerAvatar
                          src={player.imageUrl}
                          name={player.name}
                          initials={`${(player.firstName?.[0] || player.name?.[0] || "P").toUpperCase()}${(player.lastName?.[0] || player.name?.split(" ")[1]?.[0] || "").toUpperCase()}`}
                          className="w-9 h-9 rounded-full border bg-white object-cover"
                        />
                        <span>{player.name}</span>
                        <span className="text-muted-foreground">({player.team?.abbreviation || "NBA"})</span>
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
                        <PlayerAvatar
                          src={player.imageUrl}
                          name={player.name}
                          initials={`${(player.firstName?.[0] || player.name?.[0] || "P").toUpperCase()}${(player.lastName?.[0] || player.name?.split(" ")[1]?.[0] || "").toUpperCase()}`}
                          className="w-9 h-9 rounded-full border bg-white object-cover"
                        />
                        <span>{player.name}</span>
                        <span className="text-muted-foreground">({player.team?.abbreviation || "NBA"})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <ComparisonRadarChart player1={player1} player2={player2} />
        <ComparisonTable player1={player1} player2={player2} />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-secondary/30">
              <h3 className="font-medium text-foreground mb-2">{player1.name}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Projecao de pontos: <span className="text-foreground font-medium">{Number(player1.projection?.projectedPoints || 0).toFixed(1)}</span></li>
                <li>Fantasy Points: <span className="text-foreground font-medium">{Number(player1.fantasyPoints || 0).toFixed(1)}</span></li>
                <li>Confianca: <span className="text-foreground font-medium">{Number(player1.projection?.confidence || 0)}%</span></li>
                <li>Tendencia: <span className={player1.projection?.trend === "up" ? "text-green-500" : player1.projection?.trend === "down" ? "text-red-500" : "text-muted-foreground"}>{player1.projection?.trend === "up" ? "Em alta" : player1.projection?.trend === "down" ? "Em baixa" : "Estavel"}</span></li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30">
              <h3 className="font-medium text-foreground mb-2">{player2.name}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Projecao de pontos: <span className="text-foreground font-medium">{Number(player2.projection?.projectedPoints || 0).toFixed(1)}</span></li>
                <li>Fantasy Points: <span className="text-foreground font-medium">{Number(player2.fantasyPoints || 0).toFixed(1)}</span></li>
                <li>Confianca: <span className="text-foreground font-medium">{Number(player2.projection?.confidence || 0)}%</span></li>
                <li>Tendencia: <span className={player2.projection?.trend === "up" ? "text-green-500" : player2.projection?.trend === "down" ? "text-red-500" : "text-muted-foreground"}>{player2.projection?.trend === "up" ? "Em alta" : player2.projection?.trend === "down" ? "Em baixa" : "Estavel"}</span></li>
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  )
}
