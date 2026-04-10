"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar, TeamLogo } from "@/components/entity-media"
import { Bot, Send, ShieldAlert, ShieldCheck, Swords, Users } from "lucide-react"

type GameItem = {
  id: string
  gameId: string
  status: "scheduled" | "live" | "final"
  gameTime: string
  date: string
  homeTeam: { abbreviation: string; name: string; logoUrl?: string }
  awayTeam: { abbreviation: string; name: string; logoUrl?: string }
  homeScore: number
  awayScore: number
}

type MatchupPayload = {
  game: GameItem
  teamSpecialists: { home: any; away: any }
  playerSpecialists: { home: any[]; away: any[] }
  playerPredictionsSummary?: { home: PlayerDetailPayload[]; away: PlayerDetailPayload[] }
  debateRounds: Array<{
    id: string
    title: string
    homeClaim: string
    awayChallenge: string
    awayClaim: string
    homeChallenge: string
    verification: string
    winner: "home" | "away" | "draw"
  }>
  finalVerdict: {
    label: "CONFIAVEL" | "NAO CONFIAVEL"
    trustScore: number
    winner: "home" | "away" | "draw"
    summary: string
    trustBreakdown?: {
      dataQuality: number
      matchupSeparation: number
      debateConsistency: number
      penalties: number
    }
  }
  clientSummary?: {
    recommendation: string
    riskLevel: "baixo" | "medio" | "alto"
    keyDrivers: string[]
    whatCouldChange: string[]
  }
  learningSummary: Record<string, number>
  processRunId?: string
  refreshedAt?: string | null
  updatedAt?: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  confidence?: number
  sources?: string[]
}

type HealthPayload = {
  providers?: {
    database?: "configured" | "degraded" | "unavailable"
  }
}

type PlayerDetailPayload = {
  player: { id: string; name: string; firstName?: string; lastName?: string; position: string; imageUrl?: string; team?: { abbreviation?: string; logoUrl?: string } }
  statusPrediction: {
    availability: "active" | "probable" | "questionable" | "out"
    performance: "hot" | "stable" | "cold"
    confidence: number
  }
  metricScenarios: Record<string, { floor: number; base: number; ceiling: number; confidence: number }>
  agentDebate: {
    rounds: Array<{ id: string; title: string; teamAgentClaim: string; opponentAgentCounter: string; verification: string }>
    finalVerdict: "CONFIAVEL" | "NAO_CONFIAVEL"
    reasons: string[]
  }
  trustScore: number
  learningStatus: string
  cacheHit?: boolean
  cachedAt?: string
  updatedAt?: string
  sourceState?: "cache_local" | "fresh_server" | "stale"
  detailedComparison?: {
    projected: {
      points: number
      assists: number
      rebounds: number
      minutes: number
      fantasyPoints: number
      salary: number
    }
    season: {
      points: number
      assists: number
      rebounds: number
      minutes: number
      fgPct: number
      threePct: number
      ftPct: number
    }
    percentages: {
      pointsDeltaPct: number
      assistsDeltaPct: number
      reboundsDeltaPct: number
      minutesDeltaPct: number
      pointsConfidencePct: number
      assistsConfidencePct: number
      reboundsConfidencePct: number
      minutesConfidencePct: number
      overallConfidencePct: number
      trustScorePct: number
    }
    training: {
      learningStatus: string
      lastPersistedAt?: string | null
      recentLearningsCount: number
      latestLearningAt?: string | null
      avgLearningConfidencePct: number
    }
    historyWindowUsed: {
      last5GamesCount: number
      coverageRatio: number
    }
  }
}

type PlayerSummary = {
  playerId: string
  playerName: string
  position: string
  prediction?: { projectedPoints?: number; projectedAssists?: number; projectedRebounds?: number; confidence?: number }
  learningStatus?: string
  sourceState?: "cache_local" | "fresh_server" | "stale"
  statusPrediction?: { availability: string; performance: string; confidence: number }
  trustScore?: number
}

const metricOrder = ["points", "rebounds", "assists", "steals", "blocks", "turnovers", "minutes", "fouls"]
const metricLabelMap: Record<string, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  steals: "STL",
  blocks: "BLK",
  turnovers: "TO",
  minutes: "MIN",
  fouls: "FALTAS",
}

function isGamePredictable(game: any): boolean {
  const status = String(game?.status || "").toLowerCase()
  const statusId = Number(game?.GameStatus || 0)
  return status === "live" || status === "scheduled" || statusId === 1 || statusId === 2
}

function winnerLabel(winner: "home" | "away" | "draw", game?: GameItem): string {
  if (!game) return "Empate tecnico"
  if (winner === "home") return game.homeTeam?.abbreviation || "Casa"
  if (winner === "away") return game.awayTeam?.abbreviation || "Visitante"
  return "Empate tecnico"
}

function confidenceLabel(score: number) {
  if (score >= 75) return "Alta confiança"
  if (score >= 55) return "Média confiança"
  return "Baixa confiança"
}

function riskLabel(level?: "baixo" | "medio" | "alto") {
  if (level === "baixo") return "Risco baixo"
  if (level === "medio") return "Risco médio"
  return "Risco alto"
}

function learningStatusLabel(status?: string) {
  if (status === "saved") return "Atualizado agora"
  if (status === "skipped_window") return "Aguardando nova janela"
  if (status === "skipped_no_change") return "Sem mudança relevante"
  if (status === "disabled") return "Banco indisponível"
  return status || "Sem status"
}

function pctText(value?: number) {
  const n = Number(value || 0)
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

export default function PredictionsPage() {
  const [games, setGames] = useState<GameItem[]>([])
  const [selectedGameId, setSelectedGameId] = useState("")
  const [activeGameId, setActiveGameId] = useState("")
  const [matchup, setMatchup] = useState<MatchupPayload | null>(null)
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingMatchup, setLoadingMatchup] = useState(false)
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [matchupMeta, setMatchupMeta] = useState<{ source?: string; sourceHealth?: string; cacheStatus?: string } | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [metricMinConfidence, setMetricMinConfidence] = useState(70)
  const [selectedPlayerId, setSelectedPlayerId] = useState("")
  const [selectedPlayerTeamSide, setSelectedPlayerTeamSide] = useState<"home" | "away" | null>(null)
  const [loadingPlayerDetail, setLoadingPlayerDetail] = useState(false)
  const [processingPlayerId, setProcessingPlayerId] = useState<string | null>(null)
  const [playerDetail, setPlayerDetail] = useState<PlayerDetailPayload | null>(null)
  const [playerCacheMap, setPlayerCacheMap] = useState<Record<string, PlayerDetailPayload>>({})
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Chat de Predicoes ativo. Pergunte somente sobre jogos ao vivo ou programados." },
  ])

  function getPlayerCacheKey(gameId: string, playerId: string) {
    return `${gameId}:${playerId}`
  }

  async function fetchGames() {
    try {
      const response = await fetch("/api/games/today", { cache: "no-store" })
      const payload = await response.json()
      const filtered = (payload?.data || []).filter((game: any) => isGamePredictable(game))
      setGames(filtered)
      if (!selectedGameId && filtered[0]) setSelectedGameId(String(filtered[0].gameId || filtered[0].id))
      if (!filtered.length) setWarning("Nenhum jogo ao vivo ou programado disponivel no momento.")
    } catch {
      setWarning("Falha ao carregar jogos para predicoes.")
    } finally {
      setLoadingGames(false)
    }
  }

  async function fetchHealth() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" })
      setHealth(await response.json())
    } catch {
      setHealth(null)
    }
  }

  async function fetchMatchup(gameId: string, refresh = false, forcePersist = false, background = false) {
    if (!gameId) return
    if (!background) setLoadingMatchup(true)
    try {
      const response = await fetch(
        `/api/predictions/matchups/${gameId}?refresh=${refresh ? "true" : "false"}&forcePersist=${forcePersist ? "true" : "false"}`,
        { cache: "no-store" }
      )
      const payload = await response.json()
      const data = payload?.data || null
      setMatchup(data)
      setMatchupMeta({
        source: payload?.source || "none",
        sourceHealth: payload?.sourceHealth || "degraded",
        cacheStatus: payload?.cacheStatus || "rejected",
      })
      if (data?.playerPredictionsSummary) {
        const nextCache: Record<string, PlayerDetailPayload> = {}
        for (const row of [...(data.playerPredictionsSummary.home || []), ...(data.playerPredictionsSummary.away || [])]) {
          const pid = String((row as any).playerId || row?.player?.id || "")
          if (!pid) continue
          const key = getPlayerCacheKey(gameId, pid)
          nextCache[key] = {
            player: row.player || { id: pid, name: (row as any).playerName || "Player", position: (row as any).position || "SG", team: { abbreviation: (row as any).teamAbbreviation || "" } },
            statusPrediction: row.statusPrediction || { availability: "active", performance: "stable", confidence: Number((row as any).confidence || 60) },
            metricScenarios: row.metricScenarios || {},
            agentDebate: row.agentDebate || { rounds: [], finalVerdict: (Number((row as any).trustScore || 0) >= 70 ? "CONFIAVEL" : "NAO_CONFIAVEL"), reasons: [] },
            trustScore: Number((row as any).trustScore || 0),
            learningStatus: String((row as any).learningStatus || "cached"),
            cacheHit: true,
            cachedAt: (row as any).cachedAt || data.playerSummariesUpdatedAt,
          }
        }
        setPlayerCacheMap((prev) => ({ ...prev, ...nextCache }))
      }
      setWarning(payload?.warning || null)
    } catch {
      setMatchup(null)
      setMatchupMeta(null)
      setWarning("Falha ao carregar embate de especialistas.")
    } finally {
      if (!background) setLoadingMatchup(false)
    }
  }

  async function fetchPlayerDetail(gameId: string, playerId: string, refresh = false, showLoading = true) {
    if (!gameId || !playerId) return null
    if (showLoading) setLoadingPlayerDetail(true)
    setProcessingPlayerId(playerId)
    try {
      const response = await fetch(`/api/predictions/matchups/${gameId}/players/${playerId}?refresh=${refresh ? "true" : "false"}`, { cache: "no-store" })
      const payload = await response.json()
      const data = payload?.data || null
      setPlayerDetail(data)
      if (data) {
        const key = getPlayerCacheKey(gameId, playerId)
        setPlayerCacheMap((prev) => ({ ...prev, [key]: data }))
        setMatchup((prev) => {
          if (!prev?.playerPredictionsSummary) return prev
          const mergeSummary = (row: any) =>
            String(row?.playerId || row?.player?.id || "") === String(playerId)
              ? {
                  ...row,
                  statusPrediction: data.statusPrediction,
                  trustScore: data.trustScore,
                  confidence: data.statusPrediction?.confidence,
                  learningStatus: data.learningStatus,
                  metricScenarios: data.metricScenarios,
                  sourceState: data.sourceState,
                  cacheHit: data.cacheHit,
                  cachedAt: data.cachedAt,
                  updatedAt: data.updatedAt,
                }
              : row

          return {
            ...prev,
            playerPredictionsSummary: {
              home: (prev.playerPredictionsSummary.home || []).map(mergeSummary),
              away: (prev.playerPredictionsSummary.away || []).map(mergeSummary),
            },
          }
        })
      }
      if (payload?.warning) setWarning(payload.warning)
      return data as PlayerDetailPayload | null
    } catch {
      setPlayerDetail(null)
      setWarning("Falha ao carregar cenarios do jogador.")
      return null
    } finally {
      if (showLoading) setLoadingPlayerDetail(false)
      setProcessingPlayerId(null)
    }
  }

  useEffect(() => {
    fetchGames()
    fetchHealth()
  }, [])

  useEffect(() => {
    if (!loadingMatchup) return
    const timer = setInterval(() => setLoadingStepIndex((prev) => (prev + 1) % 3), 900)
    return () => clearInterval(timer)
  }, [loadingMatchup])

  const pollIntervalMs = useMemo(() => (matchup?.game?.status === "live" ? 45_000 : 180_000), [matchup?.game?.status])

  useEffect(() => {
    if (!activeGameId) return
    const timer = setInterval(() => {
      fetchGames()
      const isLive = matchup?.game?.status === "live"
      fetchMatchup(activeGameId, isLive, false, true)
    }, pollIntervalMs)
    return () => clearInterval(timer)
  }, [activeGameId, pollIntervalMs, matchup?.game?.status])

  const homePlayersSorted = useMemo(() => {
    const list = (matchup?.playerPredictionsSummary?.home?.length
      ? matchup?.playerPredictionsSummary?.home
      : matchup?.playerSpecialists?.home) || []
    return [...list].sort((a, b) => (Number(b.prediction?.projectedPoints || 0) + Number(b.prediction?.projectedAssists || 0) * 1.5 + Number(b.prediction?.projectedRebounds || 0) * 1.2) - (Number(a.prediction?.projectedPoints || 0) + Number(a.prediction?.projectedAssists || 0) * 1.5 + Number(a.prediction?.projectedRebounds || 0) * 1.2))
  }, [matchup?.playerSpecialists?.home, matchup?.playerPredictionsSummary?.home])

  const awayPlayersSorted = useMemo(() => {
    const list = (matchup?.playerPredictionsSummary?.away?.length
      ? matchup?.playerPredictionsSummary?.away
      : matchup?.playerSpecialists?.away) || []
    return [...list].sort((a, b) => (Number(b.prediction?.projectedPoints || 0) + Number(b.prediction?.projectedAssists || 0) * 1.5 + Number(b.prediction?.projectedRebounds || 0) * 1.2) - (Number(a.prediction?.projectedPoints || 0) + Number(a.prediction?.projectedAssists || 0) * 1.5 + Number(a.prediction?.projectedRebounds || 0) * 1.2))
  }, [matchup?.playerSpecialists?.away, matchup?.playerPredictionsSummary?.away])

  async function processSelectedMatchup() {
    if (!selectedGameId || loadingMatchup) return
    setActiveGameId(selectedGameId)
    setSelectedPlayerId("")
    setSelectedPlayerTeamSide(null)
    setPlayerDetail(null)
    setPlayerCacheMap({})
    await fetchMatchup(selectedGameId, true, true)
  }

  function selectPlayer(teamSide: "home" | "away", playerId: string) {
    if (!activeGameId || !playerId) return
    setSelectedPlayerId(playerId)
    setSelectedPlayerTeamSide(teamSide)
    setPlayerDetail(playerCacheMap[getPlayerCacheKey(activeGameId, playerId)] || null)
  }

  async function processPlayer(teamSide: "home" | "away", playerId: string) {
    if (!activeGameId || !playerId) return
    if (processingPlayerId && processingPlayerId !== playerId) return
    setSelectedPlayerId(playerId)
    setSelectedPlayerTeamSide(teamSide)
    const cacheKey = getPlayerCacheKey(activeGameId, playerId)
    const cachedSnapshot = playerCacheMap[cacheKey]

    if (cachedSnapshot) {
      setPlayerDetail(cachedSnapshot)
    } else {
      const summaryList = teamSide === "home" ? matchup?.playerPredictionsSummary?.home : matchup?.playerPredictionsSummary?.away
      const summarySnapshot = (summaryList || []).find((row: any) => String(row?.playerId || row?.player?.id || "") === String(playerId))
      if (summarySnapshot) setPlayerDetail(summarySnapshot as PlayerDetailPayload)
    }

    // Cache + atualizar: sempre tenta recalculo forçado no servidor ao pedir processamento.
    await fetchPlayerDetail(activeGameId, playerId, true, !cachedSnapshot)
  }

  async function sendChatMessage() {
    const message = chatInput.trim()
    if (!message || !activeGameId || chatLoading) return
    setChatMessages((prev) => [...prev, { role: "user", content: message }])
    setChatInput("")
    setChatLoading(true)
    try {
      const response = await fetch("/api/predictions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, gameId: activeGameId }),
      })
      const payload = await response.json()
      setChatMessages((prev) => [...prev, { role: "assistant", content: payload?.data?.answer || "Sem resposta no momento.", confidence: payload?.data?.confidence, sources: payload?.data?.sources || [] }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Falha ao consultar o chat de predicoes." }])
    } finally {
      setChatLoading(false)
    }
  }

  if (loadingGames) return <div className="text-muted-foreground">Carregando jogos para predicoes...</div>

  const loadingSteps = ["Buscando confronto e placar atual...", "Processando especialistas de times e jogadores...", "Montando embate e validando confiabilidade..."]
  const canProcess = Boolean(selectedGameId) && !loadingMatchup
  const isProcessedSelection = Boolean(matchup && activeGameId && selectedGameId === activeGameId)

  function renderPlayerRow(teamSide: "home" | "away", player: PlayerSummary) {
    const hasCache = Boolean(activeGameId && playerCacheMap[getPlayerCacheKey(activeGameId, player.playerId)])
    const isProcessing = processingPlayerId === player.playerId
    const disableAction = Boolean(processingPlayerId && !isProcessing)

    const sourceLabel =
      player.sourceState === "fresh_server"
        ? "Fresh servidor"
        : player.sourceState === "stale"
          ? "Stale"
          : "Cache local"
    const sourceVariant =
      player.sourceState === "fresh_server"
        ? "default"
        : player.sourceState === "stale"
          ? "destructive"
          : "secondary"
    const sourceTooltip =
      player.sourceState === "fresh_server"
        ? "Dados recalculados agora no servidor (reprocessamento recente)."
        : player.sourceState === "stale"
          ? "Snapshot antigo mantido por degradacao (upstream indisponivel)."
          : "Snapshot vindo do payload/caches do confronto, sem novo recalculo."
    const rowPts =
      Number(player.prediction?.projectedPoints || 0)
      || Number((player as any).metricScenarios?.points?.base || 0)

    return (
      <div key={player.playerId} className={`w-full flex items-center justify-between text-sm border-b pb-2 rounded px-2 py-1 ${selectedPlayerId === player.playerId ? "bg-primary/10" : ""}`}>
        <button type="button" className="text-left hover:underline" onClick={() => selectPlayer(teamSide, player.playerId)}>
          <div className="flex items-center gap-2">
            <PlayerAvatar
              src={(player as any).imageUrl}
              name={player.playerName}
              initials={`${String(player.playerName || "P").split(" ")[0]?.[0] || "P"}${String(player.playerName || "").split(" ")[1]?.[0] || ""}`}
              className="h-10 w-10 rounded-full border bg-white object-cover"
            />
            <div>
              <div className="font-medium">{player.playerName}</div>
              <div className="text-xs text-muted-foreground">{player.position}</div>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div>PTS {rowPts.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">conf {Number(player.statusPrediction?.confidence || player.prediction?.confidence || 0)}% - {learningStatusLabel(player.learningStatus)}</div>
            <Badge
              variant={sourceVariant as any}
              className="mt-1 text-[10px]"
              title={sourceTooltip}
            >
              {sourceLabel}
            </Badge>
          </div>
          <Button size="sm" variant={hasCache ? "outline" : "default"} disabled={disableAction} onClick={() => processPlayer(teamSide, player.playerId)}>
            {isProcessing ? "Processando..." : hasCache ? "Reprocessar" : "Processar"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Predicoes</h1>
        <p className="text-muted-foreground mt-1">Embate entre especialistas por confronto (somente jogos ao vivo ou programados)</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar confronto</label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger><SelectValue placeholder="Escolha um jogo" /></SelectTrigger>
                <SelectContent>
                  {games.map((game) => {
                    const value = String(game.gameId || game.id)
                    return (
                      <SelectItem key={value} value={value}>
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo src={game.awayTeam?.logoUrl} abbreviation={game.awayTeam?.abbreviation} className="h-6 w-6 rounded-sm bg-white p-0.5 object-contain" />
                          <span>{game.awayTeam?.abbreviation}</span>
                          <span>@</span>
                          <TeamLogo src={game.homeTeam?.logoUrl} abbreviation={game.homeTeam?.abbreviation} className="h-6 w-6 rounded-sm bg-white p-0.5 object-contain" />
                          <span>{game.homeTeam?.abbreviation}</span>
                          <span>- {game.gameTime}</span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={processSelectedMatchup} disabled={!canProcess}>{loadingMatchup ? "Processando..." : isProcessedSelection ? "Reprocessar" : "Processar"}</Button>
              </div>
            </div>
            {matchup?.game && (
              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium inline-flex items-center gap-2">
                    <TeamLogo src={matchup.game.awayTeam?.logoUrl} abbreviation={matchup.game.awayTeam?.abbreviation} className="h-8 w-8 rounded-sm bg-white p-0.5 object-contain" />
                    <span>{matchup.game.awayTeam?.abbreviation}</span>
                    <span>{matchup.game.awayScore} x {matchup.game.homeScore}</span>
                    <TeamLogo src={matchup.game.homeTeam?.logoUrl} abbreviation={matchup.game.homeTeam?.abbreviation} className="h-8 w-8 rounded-sm bg-white p-0.5 object-contain" />
                    <span>{matchup.game.homeTeam?.abbreviation}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Status: {matchup.game.status} - Horario: {matchup.game.gameTime}</div>
                </div>
                <Badge variant={matchup.finalVerdict?.label === "CONFIAVEL" ? "default" : "destructive"}>{matchup.finalVerdict?.label || "NAO CONFIAVEL"}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {warning && <OperationalAlert title="Dados parciais" message={warning} onRetry={() => activeGameId ? fetchMatchup(activeGameId, true, true) : fetchGames()} />}
      {health?.providers?.database !== "configured" && (
        <OperationalAlert
          title="Aprendizado em modo degradado"
          message="Aprendizado persistente indisponível. Configure o DATABASE_URL para manter histórico contínuo no banco."
        />
      )}
      {loadingMatchup && <Card className="border-primary/30 bg-primary/5"><CardContent className="py-4"><div className="flex items-center gap-3 text-sm"><Spinner className="size-4 text-primary" /><span className="text-foreground">{loadingSteps[loadingStepIndex]}</span></div></CardContent></Card>}

      {matchup && (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {matchup.finalVerdict?.label === "CONFIAVEL" ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  Resumo para cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm font-medium">{matchup.clientSummary?.recommendation || matchup.finalVerdict?.summary}</div>
                <div className="text-xs text-muted-foreground">
                  Melhor agora: <span className="font-medium text-foreground">{winnerLabel(matchup.finalVerdict?.winner || "draw", matchup.game)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Nível de risco: <span className="font-medium text-foreground">{riskLabel(matchup.clientSummary?.riskLevel)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Confiança geral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{matchup.finalVerdict?.trustScore || 0}/100</div>
                <div className="h-2 w-full rounded bg-secondary">
                  <div
                    className="h-2 rounded bg-primary transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, Number(matchup.finalVerdict?.trustScore || 0)))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{confidenceLabel(Number(matchup.finalVerdict?.trustScore || 0))}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ciclo e aprendizado</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>Atualizado: {matchup.updatedAt ? new Date(matchup.updatedAt).toLocaleString("pt-BR") : "n/a"}</div>
                <div>Processo: <span className="text-xs">{matchup.processRunId || "n/a"}</span></div>
                <div>Fonte: {matchupMeta?.source || "none"} | Saúde: {matchupMeta?.sourceHealth || "degraded"}</div>
                <div>Cache: {matchupMeta?.cacheStatus || "rejected"}</div>
                <div>saved: {matchup.learningSummary?.saved || 0} | janela: {matchup.learningSummary?.skipped_window || 0}</div>
                <div>sem mudança: {matchup.learningSummary?.skipped_no_change || 0} | banco off: {matchup.learningSummary?.disabled || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por que esse score?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <div className="rounded border p-3">
                  <div className="text-muted-foreground">Qualidade dos dados</div>
                  <div className="text-xl font-semibold">{matchup.finalVerdict?.trustBreakdown?.dataQuality ?? 0}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-muted-foreground">Diferença real entre os times</div>
                  <div className="text-xl font-semibold">{matchup.finalVerdict?.trustBreakdown?.matchupSeparation ?? 0}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-muted-foreground">Consistência do embate</div>
                  <div className="text-xl font-semibold">{matchup.finalVerdict?.trustBreakdown?.debateConsistency ?? 0}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-muted-foreground">Penalidades</div>
                  <div className="text-xl font-semibold">{matchup.finalVerdict?.trustBreakdown?.penalties ?? 0}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Drivers: {(matchup.clientSummary?.keyDrivers || []).join(" | ") || "Sem drivers detalhados"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Pode mudar com: {(matchup.clientSummary?.whatCouldChange || []).join(" | ") || "Sem alertas adicionais"}
              </div>
            </CardContent>
          </Card>

          <details className="rounded-md border p-3">
            <summary className="font-medium cursor-pointer flex items-center gap-2"><Swords className="h-4 w-4 inline-block" />Detalhes técnicos do embate</summary>
            <div className="space-y-4 mt-3">
              {(matchup.debateRounds || []).map((round) => (
                <div key={round.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{round.title}</div>
                    <Badge variant="outline">{winnerLabel(round.winner, matchup.game)}</Badge>
                  </div>
                  <div className="text-sm">{round.homeClaim}</div>
                  <div className="text-sm text-muted-foreground">{round.awayChallenge}</div>
                  <div className="text-sm">{round.awayClaim}</div>
                  <div className="text-sm text-muted-foreground">{round.homeChallenge}</div>
                  <div className="text-sm font-medium">{round.verification}</div>
                </div>
              ))}
            </div>
          </details>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Jogadores - {matchup.game.homeTeam?.abbreviation}</CardTitle></CardHeader><CardContent className="space-y-2">{homePlayersSorted.map((player) => renderPlayerRow("home", player))}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Jogadores - {matchup.game.awayTeam?.abbreviation}</CardTitle></CardHeader><CardContent className="space-y-2">{awayPlayersSorted.map((player) => renderPlayerRow("away", player))}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Predicoes do Jogador no Confronto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!selectedPlayerId && <div className="text-sm text-muted-foreground">Selecione um jogador e clique em Processar na linha para calcular cenarios.</div>}
              {selectedPlayerId && !loadingPlayerDetail && !playerDetail && <div className="text-sm text-muted-foreground">Nenhum snapshot carregado para este jogador. Clique em Processar para buscar os dados.</div>}
              {selectedPlayerId && loadingPlayerDetail && <div className="space-y-3"><div className="text-sm text-muted-foreground">Carregando cenarios do jogador...</div><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>}
              {selectedPlayerId && !loadingPlayerDetail && playerDetail && (
                <>
                  <div className="grid md:grid-cols-4 gap-3 text-sm">
                    <div className="rounded border p-3"><div className="text-muted-foreground">Disponibilidade</div><div className="font-semibold">{playerDetail.statusPrediction.availability}</div></div>
                    <div className="rounded border p-3"><div className="text-muted-foreground">Performance</div><div className="font-semibold">{playerDetail.statusPrediction.performance}</div></div>
                    <div className="rounded border p-3"><div className="text-muted-foreground">Confianca</div><div className="font-semibold">{Number(playerDetail.statusPrediction.confidence || 0)}%</div></div>
                    <div className="rounded border p-3"><div className="text-muted-foreground">Veredito</div><div className="font-semibold">{playerDetail.agentDebate.finalVerdict}</div></div>
                  </div>
                  <div className="rounded border p-3 text-sm">
                    <div className="text-muted-foreground">Jogador</div>
                    <div className="font-semibold flex items-center gap-2">
                      <PlayerAvatar
                        src={playerDetail.player.imageUrl}
                        name={playerDetail.player.name}
                        initials={`${playerDetail.player.firstName?.[0] || playerDetail.player.name?.[0] || "P"}${playerDetail.player.lastName?.[0] || ""}`}
                        className="h-14 w-14 rounded-full border bg-white object-cover"
                      />
                      <span>
                        {playerDetail.player.name} ({playerDetail.player.team?.abbreviation || (selectedPlayerTeamSide === "home" ? matchup.game.homeTeam.abbreviation : matchup.game.awayTeam.abbreviation)})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Score de confiança: {playerDetail.trustScore}/100
                      {playerDetail.cachedAt ? ` • cache local: ${new Date(playerDetail.cachedAt).toLocaleString("pt-BR")}` : ""}
                      {playerDetail.updatedAt ? ` • atualização: ${new Date(playerDetail.updatedAt).toLocaleString("pt-BR")}` : ""}
                      {playerDetail.sourceState ? ` • origem: ${playerDetail.sourceState}` : ""}
                    </div>
                    {playerDetail.sourceState && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {playerDetail.sourceState === "fresh_server" && "Origem: dados recalculados agora no servidor."}
                        {playerDetail.sourceState === "cache_local" && "Origem: snapshot do payload/cache do confronto."}
                        {playerDetail.sourceState === "stale" && "Origem: snapshot stale por degradacao de fonte externa."}
                      </div>
                    )}
                  </div>
                  {playerDetail.detailedComparison && (
                    <div className="rounded border p-3">
                      <div className="text-sm font-semibold mb-2">Comparação detalhada (confronto)</div>
                      <div className="grid md:grid-cols-3 gap-3 text-xs mb-3">
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Treinamento</div>
                          <div className="font-medium">{learningStatusLabel(playerDetail.detailedComparison.training.learningStatus)}</div>
                          <div className="text-muted-foreground">
                            últimas iterações: {playerDetail.detailedComparison.training.recentLearningsCount}
                          </div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Dados históricos usados</div>
                          <div className="font-medium">last5: {playerDetail.detailedComparison.historyWindowUsed.last5GamesCount}</div>
                          <div className="text-muted-foreground">
                            cobertura: {(playerDetail.detailedComparison.historyWindowUsed.coverageRatio * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Confianca geral</div>
                          <div className="font-medium">{playerDetail.detailedComparison.percentages.overallConfidencePct}%</div>
                          <div className="text-muted-foreground">trust: {playerDetail.detailedComparison.percentages.trustScorePct}%</div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/30">
                            <tr>
                              <th className="text-left px-2 py-2">Métrica</th>
                              <th className="text-right px-2 py-2">Valor</th>
                              <th className="text-right px-2 py-2">% ao lado</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t">
                              <td className="px-2 py-2">Pts Projetados</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.projected.points.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(playerDetail.detailedComparison.percentages.pointsDeltaPct)} • conf {playerDetail.detailedComparison.percentages.pointsConfidencePct}%</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Ast Projetadas</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.projected.assists.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(playerDetail.detailedComparison.percentages.assistsDeltaPct)} • conf {playerDetail.detailedComparison.percentages.assistsConfidencePct}%</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Reb Projetados</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.projected.rebounds.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(playerDetail.detailedComparison.percentages.reboundsDeltaPct)} • conf {playerDetail.detailedComparison.percentages.reboundsConfidencePct}%</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Min Projetados</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.projected.minutes.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(playerDetail.detailedComparison.percentages.minutesDeltaPct)} • conf {playerDetail.detailedComparison.percentages.minutesConfidencePct}%</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Pts (Temporada)</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.points.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(-playerDetail.detailedComparison.percentages.pointsDeltaPct)} vs proj.</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Ast (Temporada)</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.assists.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(-playerDetail.detailedComparison.percentages.assistsDeltaPct)} vs proj.</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Reb (Temporada)</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.rebounds.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(-playerDetail.detailedComparison.percentages.reboundsDeltaPct)} vs proj.</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Min (Temporada)</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.minutes.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">{pctText(-playerDetail.detailedComparison.percentages.minutesDeltaPct)} vs proj.</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">FG%</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.fgPct.toFixed(1)}%</td>
                              <td className="px-2 py-2 text-right">eficiência de arremesso</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">3P%</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.threePct.toFixed(1)}%</td>
                              <td className="px-2 py-2 text-right">eficiência no perímetro</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">FT%</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.season.ftPct.toFixed(1)}%</td>
                              <td className="px-2 py-2 text-right">eficiência no lance livre</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Fantasy Points</td>
                              <td className="px-2 py-2 text-right">{playerDetail.detailedComparison.projected.fantasyPoints.toFixed(1)}</td>
                              <td className="px-2 py-2 text-right">conf geral {playerDetail.detailedComparison.percentages.overallConfidencePct}%</td>
                            </tr>
                            <tr className="border-t">
                              <td className="px-2 py-2">Salário</td>
                              <td className="px-2 py-2 text-right">${(playerDetail.detailedComparison.projected.salary / 1000).toFixed(1)}K</td>
                              <td className="px-2 py-2 text-right">trust {playerDetail.detailedComparison.percentages.trustScorePct}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {!Object.keys(playerDetail.metricScenarios || {}).length && (
                    <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                      Dados insuficientes para metricas detalhadas no momento. Tente reprocessar em alguns instantes.
                    </div>
                  )}
                  <div className="overflow-x-auto rounded border">
                    <div className="flex items-center justify-end gap-2 border-b px-3 py-2">
                      <span className="text-xs text-muted-foreground">Filtro por confianca do status:</span>
                      <Select value={String(metricMinConfidence)} onValueChange={(value) => setMetricMinConfidence(Number(value))}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="60">60%</SelectItem><SelectItem value="70">70%</SelectItem><SelectItem value="80">80%</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/30"><tr>{metricOrder.map((metric) => <th key={metric} className="text-center px-2 py-2">{metricLabelMap[metric]}</th>)}</tr></thead>
                      <tbody>
                        <tr className="border-t">
                          {metricOrder.map((metric) => {
                            const scenario = playerDetail.metricScenarios?.[metric]
                            const statusConfidence = Number(playerDetail.statusPrediction?.confidence || 0)
                            if (!scenario || statusConfidence < metricMinConfidence) return <td key={metric} className="px-2 py-2 text-center text-muted-foreground">-</td>
                            return <td key={metric} className="px-2 py-2 text-center"><div>{Number(scenario.floor).toFixed(1)} | {Number(scenario.base).toFixed(1)} | {Number(scenario.ceiling).toFixed(1)}</div><Badge variant="outline" className="mt-1">{scenario.confidence}%</Badge></td>
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <details className="rounded-md border p-3 space-y-2">
                    <summary className="font-medium cursor-pointer">Embate de Agentes do Jogador</summary>
                    {(playerDetail.agentDebate.rounds || []).map((round) => <div key={round.id} className="text-sm space-y-1 mt-2"><div className="font-medium">{round.title}</div><div>{round.teamAgentClaim}</div><div className="text-muted-foreground">{round.opponentAgentCounter}</div><div className="text-xs">{round.verification}</div></div>)}
                    <div className="text-xs text-muted-foreground">Motivos: {(playerDetail.agentDebate.reasons || []).join(" | ")}</div>
                    <div className="text-xs text-muted-foreground">Aprendizado: {learningStatusLabel(playerDetail.learningStatus)}</div>
                  </details>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Chat de Predicoes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((message, idx) => (
                  <div key={`${message.role}-${idx}`} className={message.role === "user" ? "text-right" : ""}>
                    <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-foreground"}`}>{message.content}</div>
                    {message.role === "assistant" && (message.confidence || message.sources?.length) && <div className="text-xs text-muted-foreground mt-1">{message.confidence ? `Confianca: ${message.confidence}%` : ""} {message.sources?.length ? `- Fontes: ${message.sources.join(", ")}` : ""}</div>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Textarea placeholder="Pergunte sobre este confronto (somente jogo atual ou futuro)..." value={chatInput} onChange={(event) => setChatInput(event.target.value)} rows={3} />
                <div className="flex justify-end"><Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim() || !activeGameId}><Send className="h-4 w-4 mr-2" />{chatLoading ? "Analisando..." : "Perguntar"}</Button></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
