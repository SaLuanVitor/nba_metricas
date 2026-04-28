"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { InsightList } from "@/components/ai/insight-card"
import { ExpertAnalysisCard } from "@/components/ai/expert-analysis-card"
import { PlayerProbabilitiesCard } from "@/components/ai/player-probabilities-card"
import { SimulationChart } from "@/components/ai/simulation-chart"
import { TrendIndicator } from "@/components/ai/trend-indicator"
import { OperationalAlert } from "@/components/operational-alert"
import { generatePlayerProbabilities } from "@/lib/probability-engine"
import { simulatePlayerMetric } from "@/lib/simulation-engine"
import { analyzePlayer, generateInsights, analyzeTrend } from "@/lib/ai-experts"
import { Bot, Brain, LineChart, Sparkles, Users, User, MessageSquare, Send } from "lucide-react"
import type { ExpertAnalysis, Player, PlayerProbabilities, SimulationResult, StatCategory, TeamWithStats, TrendAnalysis } from "@/lib/types"

type SpecialistPayload = {
  specialist: { type: "player" | "team"; entityId: string; name: string; version: string }
  prediction: Record<string, any>
  explainability: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
    recommendation: string
    factors: string[]
  }
  recentLearnings: Array<{
    id: string
    capturedAt: string
    source: string
    confidence: number
  }>
  persisted: boolean
  learningStatus: "saved" | "skipped_window" | "skipped_no_change" | "disabled"
  lastPersistedAt?: string | null
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  confidence?: number
  sources?: string[]
}

type ChatContextType = "global" | "player" | "team"

export default function AIAnalysisPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<TeamWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("")
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const [selectedMetric, setSelectedMetric] = useState<StatCategory>("points")
  const [playerSpecialist, setPlayerSpecialist] = useState<SpecialistPayload | null>(null)
  const [teamSpecialist, setTeamSpecialist] = useState<SpecialistPayload | null>(null)
  const [specialistWarning, setSpecialistWarning] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [chatContextType, setChatContextType] = useState<ChatContextType>("global")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Sou seu Analista IA. Pergunte sobre chances, tendências, comparações e contexto de jogador/time.",
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [playersRes, teamsRes] = await Promise.all([
          fetch('/api/players'),
          fetch('/api/teams')
        ])
        
        const playersData = await playersRes.json()
        const teamsData = await teamsRes.json()
        
        if (!playersData.success || !teamsData.success) {
          throw new Error(playersData.error || teamsData.error || 'API failed')
        }
        
        setPlayers(playersData.data || [])
        setTeams(teamsData.data || [])
        
        if (playersData.data?.length > 0) {
          setSelectedPlayerId(playersData.data[0].id)
        }
        if (teamsData.data?.length > 0) {
          setSelectedTeamId(teamsData.data[0].id)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  const selectedPlayer = useMemo(() => 
    players.find(p => p.id === selectedPlayerId) || players[0],
    [players, selectedPlayerId]
  )
  
  const selectedTeam = useMemo(() => 
    teams.find(t => t.id === selectedTeamId) || teams[0],
    [teams, selectedTeamId]
  )

  const playerProbabilities = useMemo<PlayerProbabilities | null>(() => {
    if (!selectedPlayer) return null;
    return generatePlayerProbabilities(selectedPlayer)
  }, [selectedPlayer])
  
  const playerAnalysis = useMemo<ExpertAnalysis | null>(() => {
    if (!selectedPlayer) return null;
    return analyzePlayer(selectedPlayer)
  }, [selectedPlayer])
  
  const simulation = useMemo<SimulationResult | null>(() => {
    if (!selectedPlayer) return null;
    return simulatePlayerMetric(selectedPlayer, selectedMetric, 5000)
  }, [selectedPlayer, selectedMetric])
  
  const trendAnalysis = useMemo<TrendAnalysis | null>(() => {
    if (!selectedPlayer) return null;
    return analyzeTrend(selectedPlayer, selectedMetric)
  }, [selectedPlayer, selectedMetric])
  
  const insights = useMemo(() => {
    if (players.length === 0 || teams.length === 0) return []
    return generateInsights(players, teams)
  }, [players, teams])

  useEffect(() => {
    async function fetchPlayerSpecialist() {
      if (!selectedPlayerId) return
      try {
        const res = await fetch(`/api/ai/specialists/players/${selectedPlayerId}`, { cache: "no-store" })
        const payload = await res.json()
        setPlayerSpecialist(payload?.data || null)
        setSpecialistWarning(payload?.warning || null)
      } catch {
        setPlayerSpecialist(null)
      }
    }
    fetchPlayerSpecialist()
  }, [selectedPlayerId])

  useEffect(() => {
    async function fetchTeamSpecialist() {
      if (!selectedTeamId) return
      try {
        const res = await fetch(`/api/ai/specialists/teams/${selectedTeamId}`, { cache: "no-store" })
        const payload = await res.json()
        setTeamSpecialist(payload?.data || null)
        setSpecialistWarning(payload?.warning || null)
      } catch {
        setTeamSpecialist(null)
      }
    }
    fetchTeamSpecialist()
  }, [selectedTeamId])

  async function sendChatMessage() {
    const message = chatInput.trim()
    if (!message || chatLoading) return
    setChatMessages((prev) => [...prev, { role: "user", content: message }])
    setChatInput("")
    setChatLoading(true)
    try {
      const contextType = chatContextType
      const contextId = contextType === "player" ? selectedPlayerId : contextType === "team" ? selectedTeamId : undefined
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contextType, contextId }),
      })
      const payload = await res.json()
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload?.data?.answer || "Não consegui responder agora.",
          confidence: payload?.data?.confidence,
          sources: payload?.data?.sources || [],
        },
      ])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Falha ao consultar o analista neste momento." }])
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Carregando...</div>
  }

  if (error) {
    return <div className="text-red-400">Erro: {error}</div>
  }

  if (players.length === 0) {
    return <div className="text-muted-foreground">Nenhum dado disponivel - APIs indisponiveis</div>
  }

  if (teams.length === 0) {
    return <div className="text-muted-foreground">Nenhum time disponivel no momento</div>
  }

  const metricLabel = selectedMetric === "points" ? "Pontos" : 
    selectedMetric === "assists" ? "Assistencias" : 
    selectedMetric === "rebounds" ? "Rebotes" : "Minutos"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analise de IA</h1>
            <p className="text-muted-foreground">
              Insights e predicoes baseadas em inteligencia artificial
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">O que isso significa:</strong> esta aba resume tendências e cenários de forma assistida. Use como apoio de decisão, não como certeza absoluta.
        </div>
        {specialistWarning && (
          <OperationalAlert title="Dados parciais no momento" message={specialistWarning} />
        )}
      </div>
      
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Insights em Tempo Real</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightList insights={insights} maxItems={6} />
        </div>
      </section>
      
      <Tabs defaultValue="player" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="player" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Analise de Jogador
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Analise de Time
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat Analista
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="player" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Selecione o Jogador</label>
                  <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um jogador" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} - {player.team?.abbreviation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-2 block">Metrica</label>
                  <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as StatCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">Pontos</SelectItem>
                      <SelectItem value="assists">Assistencias</SelectItem>
                      <SelectItem value="rebounds">Rebotes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {selectedPlayer && playerAnalysis && playerProbabilities && (
            <div className="grid lg:grid-cols-2 gap-6">
              <ExpertAnalysisCard analysis={playerAnalysis} entityName={selectedPlayer.name} />
              
              <PlayerProbabilitiesCard 
                probabilities={playerProbabilities} 
                playerName={selectedPlayer.name} 
              />
            </div>
          )}
          
          {selectedPlayer && simulation && trendAnalysis && (
            <div className="grid lg:grid-cols-2 gap-6">
              <SimulationChart 
                simulation={simulation}
                title={`Simulacao de ${metricLabel} (5000 iteracoes)`}
                line={selectedPlayer.seasonStats?.points || 15}
                height={250}
              />
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LineChart className="h-5 w-5 text-primary" />
                      Analise de Tendencia
                    </CardTitle>
                    <TrendIndicator 
                      direction={trendAnalysis.direction} 
                      magnitude={trendAnalysis.magnitude}
                      showLabel
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlayer ? `${selectedPlayer.name} - dados carregados` : 'Selecione um jogador'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedPlayer && playerSpecialist && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Especialista do Jogador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{playerSpecialist.explainability.summary}</p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-secondary/40 p-3">
                    <div className="text-muted-foreground">Projeção</div>
                    <div className="font-medium">PTS {Number(playerSpecialist.prediction.projectedPoints || 0).toFixed(1)} • AST {Number(playerSpecialist.prediction.projectedAssists || 0).toFixed(1)} • REB {Number(playerSpecialist.prediction.projectedRebounds || 0).toFixed(1)}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3">
                    <div className="text-muted-foreground">Aprendizado</div>
                    <div className="font-medium">{playerSpecialist.learningStatus} {playerSpecialist.lastPersistedAt ? `• ${new Date(playerSpecialist.lastPersistedAt).toLocaleString("pt-BR")}` : ""}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Persistência: {String(playerSpecialist.persisted)} {specialistWarning ? `• ${specialistWarning}` : ""}
                </div>
                {playerSpecialist.recentLearnings?.length > 0 && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {playerSpecialist.recentLearnings.slice(0, 3).map((l) => (
                      <div key={l.id}>{new Date(l.capturedAt).toLocaleString("pt-BR")} • conf. {l.confidence}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Selecione o Time</label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Escolha um time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name || team.abbreviation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {selectedTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  {selectedTeam.name || selectedTeam.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground">
                  Time selecionado - dados da API carregados
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTeam && teamSpecialist && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Especialista do Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{teamSpecialist.explainability.summary}</p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-secondary/40 p-3">
                    <div className="text-muted-foreground">Predição</div>
                    <div className="font-medium">PTS {Number(teamSpecialist.prediction.expectedPoints || 0).toFixed(1)} • OFF {Number(teamSpecialist.prediction.offensiveRating || 0).toFixed(1)} • DEF {Number(teamSpecialist.prediction.defensiveRating || 0).toFixed(1)}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 p-3">
                    <div className="text-muted-foreground">Aprendizado</div>
                    <div className="font-medium">{teamSpecialist.learningStatus} {teamSpecialist.lastPersistedAt ? `• ${new Date(teamSpecialist.lastPersistedAt).toLocaleString("pt-BR")}` : ""}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Persistência: {String(teamSpecialist.persisted)} {specialistWarning ? `• ${specialistWarning}` : ""}
                </div>
                {teamSpecialist.recentLearnings?.length > 0 && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {teamSpecialist.recentLearnings.slice(0, 3).map((l) => (
                      <div key={l.id}>{new Date(l.capturedAt).toLocaleString("pt-BR")} • conf. {l.confidence}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Chat Analista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <label className="text-sm font-medium mb-2 block">Contexto da pergunta</label>
                <Select value={chatContextType} onValueChange={(v) => setChatContextType(v as ChatContextType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="player" disabled={!selectedPlayerId}>Jogador selecionado</SelectItem>
                    <SelectItem value="team" disabled={!selectedTeamId}>Time selecionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg, idx) => (
                  <div key={`${msg.role}-${idx}`} className={msg.role === "user" ? "text-right" : ""}>
                    <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-foreground"}`}>
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && (msg.confidence || msg.sources?.length) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {msg.confidence ? `Confiança: ${msg.confidence}%` : ""} {msg.sources?.length ? `• Fontes: ${msg.sources.join(", ")}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Pergunte sobre chances, tendências, contexto do projeto, riscos e comparações..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    {chatLoading ? "Analisando..." : "Perguntar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
