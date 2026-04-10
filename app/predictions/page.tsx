"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Bot, ShieldCheck, ShieldAlert, Send, Swords, Users } from "lucide-react"

type GameItem = {
  id: string
  gameId: string
  status: "scheduled" | "live" | "final"
  gameTime: string
  date: string
  homeTeam: { abbreviation: string; name: string }
  awayTeam: { abbreviation: string; name: string }
  homeScore: number
  awayScore: number
}

type MatchupPayload = {
  game: GameItem
  teamSpecialists: {
    home: any
    away: any
  }
  playerSpecialists: {
    home: any[]
    away: any[]
  }
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
    reasons: string[]
  }
  learningSummary: Record<string, number>
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  confidence?: number
  sources?: string[]
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

export default function PredictionsPage() {
  const [games, setGames] = useState<GameItem[]>([])
  const [selectedGameId, setSelectedGameId] = useState<string>("")
  const [matchup, setMatchup] = useState<MatchupPayload | null>(null)
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingMatchup, setLoadingMatchup] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Chat de Predicoes ativo. Pergunte somente sobre jogos ao vivo ou programados.",
    },
  ])

  async function fetchGames() {
    try {
      const response = await fetch("/api/games/today", { cache: "no-store" })
      const payload = await response.json()
      const filtered = (payload?.data || []).filter((game: any) => isGamePredictable(game))
      setGames(filtered)
      if (!selectedGameId && filtered[0]) {
        setSelectedGameId(String(filtered[0].gameId || filtered[0].id))
      }
      if (!filtered.length) {
        setWarning("Nenhum jogo ao vivo ou programado disponivel no momento.")
      }
    } catch {
      setWarning("Falha ao carregar jogos para predicoes.")
    } finally {
      setLoadingGames(false)
    }
  }

  async function fetchMatchup(gameId: string) {
    if (!gameId) return
    setLoadingMatchup(true)
    try {
      const response = await fetch(`/api/predictions/matchups/${gameId}`, { cache: "no-store" })
      const payload = await response.json()
      setMatchup(payload?.data || null)
      setWarning(payload?.warning || null)
    } catch {
      setMatchup(null)
      setWarning("Falha ao carregar embate de especialistas.")
    } finally {
      setLoadingMatchup(false)
    }
  }

  useEffect(() => {
    fetchGames()
  }, [])

  useEffect(() => {
    if (!selectedGameId) return
    fetchMatchup(selectedGameId)
  }, [selectedGameId])

  const pollIntervalMs = useMemo(() => {
    const status = matchup?.game?.status
    if (status === "live") return 45_000
    return 180_000
  }, [matchup?.game?.status])

  useEffect(() => {
    if (!selectedGameId) return
    const timer = setInterval(() => {
      fetchGames()
      fetchMatchup(selectedGameId)
    }, pollIntervalMs)
    return () => clearInterval(timer)
  }, [selectedGameId, pollIntervalMs])

  async function sendChatMessage() {
    const message = chatInput.trim()
    if (!message || !selectedGameId || chatLoading) return
    setChatMessages((prev) => [...prev, { role: "user", content: message }])
    setChatInput("")
    setChatLoading(true)
    try {
      const response = await fetch("/api/predictions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, gameId: selectedGameId }),
      })
      const payload = await response.json()
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload?.data?.answer || "Sem resposta no momento.",
          confidence: payload?.data?.confidence,
          sources: payload?.data?.sources || [],
        },
      ])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Falha ao consultar o chat de predicoes." }])
    } finally {
      setChatLoading(false)
    }
  }

  if (loadingGames) {
    return <div className="text-muted-foreground">Carregando jogos para predicoes...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Predicoes</h1>
        <p className="text-muted-foreground mt-1">
          Embate entre especialistas por confronto (somente jogos ao vivo ou programados)
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar confronto</label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um jogo" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((game) => {
                    const value = String(game.gameId || game.id)
                    return (
                      <SelectItem key={value} value={value}>
                        {game.awayTeam?.abbreviation} @ {game.homeTeam?.abbreviation} - {game.gameTime}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {matchup?.game && (
              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {matchup.game.awayTeam?.abbreviation} {matchup.game.awayScore} x {matchup.game.homeScore} {matchup.game.homeTeam?.abbreviation}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {matchup.game.status} - Horario: {matchup.game.gameTime}
                  </div>
                </div>
                <Badge variant={matchup.finalVerdict?.label === "CONFIAVEL" ? "default" : "destructive"}>
                  {matchup.finalVerdict?.label || "NAO CONFIAVEL"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {warning && (
        <Card className="border-yellow-500/40">
          <CardContent className="py-3 text-sm text-yellow-400">{warning}</CardContent>
        </Card>
      )}

      {loadingMatchup && <div className="text-muted-foreground">Atualizando embate...</div>}

      {matchup && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {matchup.finalVerdict?.label === "CONFIAVEL" ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  Veredito Final
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchup.finalVerdict?.trustScore || 0}/100</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {matchup.finalVerdict?.summary}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Vencedor tecnico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {winnerLabel(matchup.finalVerdict?.winner || "draw", matchup.game)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aprendizado (5 min)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>saved: {matchup.learningSummary?.saved || 0}</div>
                <div>skipped_window: {matchup.learningSummary?.skipped_window || 0}</div>
                <div>skipped_no_change: {matchup.learningSummary?.skipped_no_change || 0}</div>
                <div>disabled: {matchup.learningSummary?.disabled || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{matchup.game.homeTeam?.abbreviation} Specialist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">{matchup.teamSpecialists.home?.explainability?.summary}</div>
                <div>Confianca: <span className="font-semibold">{Number(matchup.teamSpecialists.home?.prediction?.confidence || 0)}%</span></div>
                <div>Recomendacao: {matchup.teamSpecialists.home?.explainability?.recommendation}</div>
                <div className="text-xs text-muted-foreground">
                  learningStatus: {matchup.teamSpecialists.home?.learningStatus} - persisted: {String(matchup.teamSpecialists.home?.persisted)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{matchup.game.awayTeam?.abbreviation} Specialist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">{matchup.teamSpecialists.away?.explainability?.summary}</div>
                <div>Confianca: <span className="font-semibold">{Number(matchup.teamSpecialists.away?.prediction?.confidence || 0)}%</span></div>
                <div>Recomendacao: {matchup.teamSpecialists.away?.explainability?.recommendation}</div>
                <div className="text-xs text-muted-foreground">
                  learningStatus: {matchup.teamSpecialists.away?.learningStatus} - persisted: {String(matchup.teamSpecialists.away?.persisted)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5" />
                Embate por Rodadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Jogadores - {matchup.game.homeTeam?.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(matchup.playerSpecialists?.home || []).slice(0, 12).map((player) => (
                  <div key={player.playerId} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <div className="font-medium">{player.playerName}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                    <div className="text-right">
                      <div>PTS {Number(player.prediction?.projectedPoints || 0).toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        conf {Number(player.prediction?.confidence || 0)}% - {player.learningStatus}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Jogadores - {matchup.game.awayTeam?.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(matchup.playerSpecialists?.away || []).slice(0, 12).map((player) => (
                  <div key={player.playerId} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <div className="font-medium">{player.playerName}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                    <div className="text-right">
                      <div>PTS {Number(player.prediction?.projectedPoints || 0).toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        conf {Number(player.prediction?.confidence || 0)}% - {player.learningStatus}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Chat de Predicoes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((message, idx) => (
                  <div key={`${message.role}-${idx}`} className={message.role === "user" ? "text-right" : ""}>
                    <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-foreground"}`}>
                      {message.content}
                    </div>
                    {message.role === "assistant" && (message.confidence || message.sources?.length) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {message.confidence ? `Confianca: ${message.confidence}%` : ""} {message.sources?.length ? `- Fontes: ${message.sources.join(", ")}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Pergunte sobre este confronto (somente jogo atual ou futuro)..."
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim() || !selectedGameId}>
                    <Send className="h-4 w-4 mr-2" />
                    {chatLoading ? "Analisando..." : "Perguntar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
