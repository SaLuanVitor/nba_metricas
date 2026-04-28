"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, ArrowUpRight, RefreshCw, ShieldAlert, SlidersHorizontal, Target } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type TodayGame = {
  id: string
  status?: string
  date?: string
  gameTime?: string
  homeTeam?: { abbreviation?: string; name?: string; city?: string }
  awayTeam?: { abbreviation?: string; name?: string; city?: string }
}

type TodayPick = {
  predictionId: string
  gameId: string
  playerId: string
  playerName: string
  team?: string
  market: "player_points" | "player_assists" | "player_rebounds"
  side: "over"
  line: number
  probability: number
  confidence: string
  edge: number | null
  expectedValue: number | null
  riskLevel: "baixo" | "medio" | "alto"
  reasons: string[]
  sportsbook?: string
  americanOdds?: number | null
  auditUrl: string
}

type TodayPayload = {
  data?: {
    games?: TodayGame[]
    picks?: TodayPick[]
    modelVersion?: string
    filters?: Record<string, unknown>
    oddsSnapshotStatus?: {
      scannedPlayerMarketSnapshots: number
      hasUsableSnapshots: boolean
      collectionRequired: boolean
      collectEndpoint: string
    }
  }
  warning?: string
  sourceHealth?: string
  cacheStatus?: string
  generatedAt?: string
}

const marketLabels: Record<TodayPick["market"], string> = {
  player_points: "Pontos",
  player_assists: "Assistencias",
  player_rebounds: "Rebotes",
}

const riskLabels: Record<TodayPick["riskLevel"], string> = {
  baixo: "Baixo",
  medio: "Medio",
  alto: "Alto",
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  return `${Number(value).toFixed(1)}%`
}

function signedPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  const n = Number(value) * 100
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

function evText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  const n = Number(value)
  return `${n >= 0 ? "+" : ""}${n.toFixed(3)}u`
}

function gameLabel(game?: TodayGame) {
  if (!game) return "Jogo"
  const away = game.awayTeam?.abbreviation || game.awayTeam?.name || "Away"
  const home = game.homeTeam?.abbreviation || game.homeTeam?.name || "Home"
  return `${away} @ ${home}`
}

export default function TodayPage() {
  const [payload, setPayload] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameId, setGameId] = useState("all")
  const [market, setMarket] = useState("all")
  const [riskLevel, setRiskLevel] = useState("all")
  const [minProbability, setMinProbability] = useState("55")
  const [minEdgePct, setMinEdgePct] = useState("")

  const games = payload?.data?.games || []
  const picks = payload?.data?.picks || []
  const oddsStatus = payload?.data?.oddsSnapshotStatus

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (gameId !== "all") params.set("gameId", gameId)
    if (market !== "all") params.set("market", market)
    if (riskLevel !== "all") params.set("riskLevel", riskLevel)
    if (minProbability.trim()) params.set("minProbability", minProbability.trim())
    if (minEdgePct.trim()) params.set("minEdgePct", minEdgePct.trim())
    return params.toString()
  }, [gameId, market, riskLevel, minProbability, minEdgePct])

  async function loadToday() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/predictions/today${query ? `?${query}` : ""}`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok || !json?.success) {
        setError(json?.warning || json?.message || "Falha ao carregar predicoes de hoje.")
      }
      setPayload(json)
    } catch {
      setError("Falha temporaria ao carregar predicoes de hoje.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadToday()
  }, [query])

  const selectedGame = useMemo(() => {
    const byId = new Map(games.map((game) => [game.id, game]))
    return byId
  }, [games])

  const summary = useMemo(() => {
    const lowRisk = picks.filter((pick) => pick.riskLevel === "baixo").length
    const positiveEv = picks.filter((pick) => Number(pick.expectedValue || 0) > 0).length
    const avgProbability = picks.length
      ? picks.reduce((sum, pick) => sum + Number(pick.probability || 0), 0) / picks.length
      : 0
    return { lowRisk, positiveEv, avgProbability }
  }, [picks])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hoje</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Picks de props com probabilidade, edge, valor esperado, risco e auditoria. Use como apoio analitico, nao como garantia de resultado.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadToday} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Jogos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{loading ? <Skeleton className="h-8 w-14" /> : games.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Picks</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{loading ? <Skeleton className="h-8 w-14" /> : picks.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">EV positivo</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{loading ? <Skeleton className="h-8 w-14" /> : summary.positiveEv}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Prob. media</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{loading ? <Skeleton className="h-8 w-20" /> : pct(summary.avgProbability)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Jogo</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {games.map((game) => <SelectItem key={game.id} value={game.id}>{gameLabel(game)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mercado</Label>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="player_points">Pontos</SelectItem>
                <SelectItem value="player_assists">Assistencias</SelectItem>
                <SelectItem value="player_rebounds">Rebotes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Risco</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min-probability">Prob. min.</Label>
            <Input id="min-probability" inputMode="numeric" value={minProbability} onChange={(event) => setMinProbability(event.target.value)} placeholder="55" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min-edge">Edge min.</Label>
            <Input id="min-edge" inputMode="decimal" value={minEdgePct} onChange={(event) => setMinEdgePct(event.target.value)} placeholder="2" />
          </div>
        </CardContent>
      </Card>

      {(error || payload?.warning || oddsStatus?.collectionRequired) && (
        <Alert variant={error ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{error ? "Falha na consulta" : oddsStatus?.collectionRequired ? "Odds nao coletadas" : "Dados parciais"}</AlertTitle>
          <AlertDescription>
            {error || payload?.warning || "Ainda nao ha snapshots de odds utilizaveis para gerar picks."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Jogos do dia</h2>
          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && games.map((game) => (
            <button
              type="button"
              key={game.id}
              onClick={() => setGameId(game.id)}
              className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-secondary/40 ${gameId === game.id ? "border-primary bg-primary/5" : "bg-card"}`}
            >
              <div className="font-medium">{gameLabel(game)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{game.gameTime || "--:--"} - {game.status || "scheduled"}</div>
            </button>
          ))}
          {!loading && !games.length && <p className="text-sm text-muted-foreground">Nenhum jogo disponivel no momento.</p>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Props candidatas</h2>
            <Badge variant="outline">{payload?.data?.modelVersion || "Prediction Engine v1"}</Badge>
          </div>
          {loading && <Skeleton className="h-40 w-full" />}
          {!loading && !picks.length && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-8 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="font-medium">Sem picks com os filtros atuais</div>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                  Quando houver snapshots de odds e cobertura suficiente, as picks aparecem aqui com probabilidade, edge, EV, risco e link de auditoria.
                </p>
              </CardContent>
            </Card>
          )}
          {!loading && picks.map((pick) => (
            <Card key={pick.predictionId}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{marketLabels[pick.market]}</Badge>
                      <Badge variant={pick.riskLevel === "alto" ? "destructive" : "outline"}>Risco {riskLabels[pick.riskLevel]}</Badge>
                      <span className="text-xs text-muted-foreground">{gameLabel(selectedGame.get(pick.gameId))}</span>
                    </div>
                    <div className="mt-2 text-lg font-semibold">{pick.playerName} over {Number(pick.line).toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">{pick.team || "-"} - {pick.sportsbook || "sportsbook"} {pick.americanOdds ? `- ${pick.americanOdds}` : ""}</div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/predictions/${pick.predictionId}`}>
                      Auditoria
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Probabilidade</div>
                    <div className="mt-1 text-lg font-semibold">{pct(pick.probability)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Edge</div>
                    <div className="mt-1 text-lg font-semibold">{signedPct(pick.edge)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">EV</div>
                    <div className="mt-1 text-lg font-semibold">{evText(pick.expectedValue)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Confianca</div>
                    <div className="mt-1 text-lg font-semibold">{pick.confidence}</div>
                  </div>
                </div>

                {!!pick.reasons?.length && (
                  <div className="rounded-md bg-secondary/30 p-3 text-sm text-muted-foreground">
                    <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                      <Target className="h-4 w-4" />
                      Principais razoes
                    </div>
                    <ul className="list-inside list-disc space-y-1">
                      {pick.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
