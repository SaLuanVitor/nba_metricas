"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TeamComparisonRadar } from "@/components/team-comparison-radar"
import { OperationalAlert } from "@/components/operational-alert"
import { PlayerAvatar, TeamLogo } from "@/components/entity-media"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"
import type { Player, TeamWithStats } from "@/lib/types"

export default function TeamComparePage() {
  const [teams, setTeams] = useState<TeamWithStats[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [team1Id, setTeam1Id] = useState<string>("")
  const [team2Id, setTeam2Id] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiMeta, setApiMeta] = useState<{ source?: string; sourceHealth?: string; cacheStatus?: string; warning?: string } | null>(null)

  const teamStrengthScore = (team: TeamWithStats) => {
    const wins = Number(team.stats?.wins || 0)
    const losses = Number(team.stats?.losses || 0)
    const gp = Math.max(1, wins + losses)
    const winPctScore = (wins / gp) * 50
    const offScore = Number(team.stats?.offensiveRating || 0) * 0.2
    const defScore = (120 - Number(team.stats?.defensiveRating || 120)) * 0.2
    return winPctScore + offScore + defScore
  }

  const riskLabel = (sourceHealth?: string) => (sourceHealth === "ok" ? "Risco baixo" : "Risco medio")

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const [teamsRes, playersRes] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/players", { cache: "no-store" }),
      ])
      const teamsJson = await teamsRes.json()
      const playersJson = await playersRes.json()

      if (!teamsRes.ok || !teamsJson.success) {
        throw new Error(teamsJson.error || "Falha ao carregar times")
      }
      if (!playersRes.ok || !playersJson.success) {
        throw new Error(playersJson.error || "Falha ao carregar jogadores")
      }

      const fetchedTeams: TeamWithStats[] = teamsJson.data || []
      setTeams(fetchedTeams)
      setPlayers(playersJson.data || [])
      setApiMeta({
        source: teamsJson.source || playersJson.source,
        sourceHealth: teamsJson.sourceHealth || playersJson.sourceHealth,
        cacheStatus: teamsJson.cacheStatus || playersJson.cacheStatus,
        warning: teamsJson.warning || playersJson.warning,
      })
      if (fetchedTeams[0]) setTeam1Id(fetchedTeams[0].id)
      if (fetchedTeams[1]) setTeam2Id(fetchedTeams[1].id)
    } catch (err: any) {
      setError(err.message || "Erro ao carregar comparacao")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const team1 = teams.find((t) => t.id === team1Id)
  const team2 = teams.find((t) => t.id === team2Id)

  const team1Roster = useMemo(
    () => players.filter((p) => p.team?.id === team1Id),
    [players, team1Id]
  )
  const team2Roster = useMemo(
    () => players.filter((p) => p.team?.id === team2Id),
    [players, team2Id]
  )

  const compareStats = [
    { label: "Vitorias", key: "wins", better: "higher" },
    { label: "Derrotas", key: "losses", better: "lower" },
    { label: "Pontos/Jogo", key: "pointsPerGame", better: "higher" },
    { label: "Assistencias/Jogo", key: "assistsPerGame", better: "higher" },
    { label: "Rebotes/Jogo", key: "reboundsPerGame", better: "higher" },
    { label: "Roubos/Jogo", key: "stealsPerGame", better: "higher" },
    { label: "Tocos/Jogo", key: "blocksPerGame", better: "higher" },
    { label: "Turnovers/Jogo", key: "turnoversPerGame", better: "lower" },
    { label: "FG%", key: "fieldGoalPercentage", better: "higher" },
    { label: "3P%", key: "threePointPercentage", better: "higher" },
    { label: "FT%", key: "freeThrowPercentage", better: "higher" },
    { label: "Off Rating", key: "offensiveRating", better: "higher" },
    { label: "Def Rating", key: "defensiveRating", better: "lower" },
    { label: "Pace", key: "pace", better: "higher" },
  ] as const

  const getWinner = (stat: typeof compareStats[number]) => {
    if (!team1 || !team2) return null
    const val1 = Number(team1.stats?.[stat.key as keyof typeof team1.stats] || 0)
    const val2 = Number(team2.stats?.[stat.key as keyof typeof team2.stats] || 0)
    if (val1 === val2) return "tie"
    if (stat.better === "higher") return val1 > val2 ? "team1" : "team2"
    return val1 < val2 ? "team1" : "team2"
  }

  if (loading) {
    return <div className="text-muted-foreground">Carregando comparacao de times...</div>
  }

  if (error) {
    return <OperationalAlert severity="error" title="Falha temporaria" message={error} onRetry={fetchData} />
  }

  const team1Strength = team1 ? teamStrengthScore(team1) : 0
  const team2Strength = team2 ? teamStrengthScore(team2) : 0
  const winnerNow =
    !team1 || !team2
      ? "Indefinido"
      : Math.abs(team1Strength - team2Strength) < 2
        ? "Confronto equilibrado"
        : team1Strength > team2Strength
          ? `${team1.city} ${team1.name}`
          : `${team2.city} ${team2.name}`

  const safeTeam = (team?: TeamWithStats | null) => ({
    id: team?.id || "",
    city: team?.city || "Time",
    name: team?.name || "NBA",
    abbreviation: team?.abbreviation || "NBA",
    logoUrl: team?.logoUrl || "",
    primaryColor: team?.primaryColor || "#1D428A",
    conference: team?.conference || "N/A",
    confRank: Number(team?.rank?.conference || 0),
    wins: Number(team?.stats?.wins || 0),
    losses: Number(team?.stats?.losses || 0),
  })

  const t1 = safeTeam(team1)
  const t2 = safeTeam(team2)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Comparar Times</h1>
        <p className="text-muted-foreground mt-1">
          Compare estatisticas completas entre dois times da NBA
        </p>
      </div>

      {(apiMeta?.sourceHealth === "degraded" || apiMeta?.warning) && (
        <OperationalAlert
          title="Dados parciais no momento"
          message={apiMeta?.warning || "Algumas fontes estao instaveis; os numeros podem oscilar."}
          onRetry={fetchData}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo para cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Melhor agora: <span className="font-medium">{winnerNow}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risco da leitura</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{riskLabel(apiMeta?.sourceHealth)}</div>
            <div className="text-muted-foreground">Baseado na saude das fontes e estabilidade dos dados.</div>
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
          Esta comparacao indica tendencia e risco. Com fonte degradada, use como sinal de apoio e confirme perto do jogo.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <Select value={team1Id} onValueChange={setTeam1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o primeiro time" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem
                      key={team.id}
                      value={team.id}
                      disabled={team.id === team2Id}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4"
                        >
                          <TeamLogo
                            src={team.logoUrl}
                            abbreviation={team.abbreviation}
                            className="h-6 w-6 rounded-sm bg-white p-0.5 object-contain"
                          />
                        </div>
                        {team.city || "Time"} {team.name || "NBA"}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-muted-foreground font-bold">VS</span>
              </div>
            </div>

            <div className="flex-1 w-full">
              <Select value={team2Id} onValueChange={setTeam2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segundo time" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem
                      key={team.id}
                      value={team.id}
                      disabled={team.id === team1Id}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4"
                        >
                          <TeamLogo
                            src={team.logoUrl}
                            abbreviation={team.abbreviation}
                            className="h-6 w-6 rounded-sm bg-white p-0.5 object-contain"
                          />
                        </div>
                        {team.city || "Time"} {team.name || "NBA"}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {team1 && team2 && (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <TeamLogo
                    src={t1.logoUrl}
                    abbreviation={t1.abbreviation}
                    className="h-20 w-20 rounded-lg border bg-white p-1 object-contain"
                    loading="eager"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {t1.city} {t1.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {t1.wins}-{t1.losses}
                      </Badge>
                      <Badge variant="secondary">
                        #{t1.confRank} {t1.conference}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <TeamLogo
                    src={t2.logoUrl}
                    abbreviation={t2.abbreviation}
                    className="h-20 w-20 rounded-lg border bg-white p-1 object-contain"
                    loading="eager"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {t2.city} {t2.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {t2.wins}-{t2.losses}
                      </Badge>
                      <Badge variant="secondary">
                        #{t2.confRank} {t2.conference}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparacao Visual</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamComparisonRadar team1={team1} team2={team2} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparacao de Estatisticas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-1/3">{t1.abbreviation}</TableHead>
                    <TableHead className="text-center">Estatistica</TableHead>
                    <TableHead className="w-1/3">{t2.abbreviation}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareStats.map((stat) => {
                    const winner = getWinner(stat)
                    const val1 = Number(team1.stats?.[stat.key as keyof typeof team1.stats] || 0)
                    const val2 = Number(team2.stats?.[stat.key as keyof typeof team2.stats] || 0)
                    return (
                      <TableRow key={stat.key}>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            winner === "team1" && "text-green-500"
                          )}
                        >
                          <div className="flex items-center justify-end gap-2">
                            {winner === "team1" && <Trophy className="h-4 w-4" />}
                            {val1.toFixed(1)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {stat.label}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-medium",
                            winner === "team2" && "text-green-500"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {val2.toFixed(1)}
                            {winner === "team2" && <Trophy className="h-4 w-4" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TeamLogo
                    src={t1.logoUrl}
                    abbreviation={t1.abbreviation}
                    className="h-7 w-7 rounded-sm bg-white p-0.5 object-contain"
                  />
                  Elenco {t1.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jogador</TableHead>
                      <TableHead className="text-center">Pos</TableHead>
                      <TableHead className="text-right">PTS</TableHead>
                      <TableHead className="text-right">AST</TableHead>
                      <TableHead className="text-right">REB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team1Roster
                      .sort((a, b) => Number(b.fantasyPoints || 0) - Number(a.fantasyPoints || 0))
                      .map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar
                              src={player.imageUrl}
                              name={player.name}
                              initials={`${player.firstName?.[0] || "P"}${player.lastName?.[0] || ""}`}
                              className="h-10 w-10 rounded-full border bg-white object-cover"
                            />
                            <span>{player.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {player.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedPoints || 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedAssists || 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedRebounds || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TeamLogo
                    src={t2.logoUrl}
                    abbreviation={t2.abbreviation}
                    className="h-7 w-7 rounded-sm bg-white p-0.5 object-contain"
                  />
                  Elenco {t2.abbreviation}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jogador</TableHead>
                      <TableHead className="text-center">Pos</TableHead>
                      <TableHead className="text-right">PTS</TableHead>
                      <TableHead className="text-right">AST</TableHead>
                      <TableHead className="text-right">REB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team2Roster
                      .sort((a, b) => Number(b.fantasyPoints || 0) - Number(a.fantasyPoints || 0))
                      .map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar
                              src={player.imageUrl}
                              name={player.name}
                              initials={`${player.firstName?.[0] || "P"}${player.lastName?.[0] || ""}`}
                              className="h-10 w-10 rounded-full border bg-white object-cover"
                            />
                            <span>{player.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {player.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedPoints || 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedAssists || 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(player.projection?.projectedRebounds || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {(!team1 || !team2) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Selecione dois times para comparar suas estatisticas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
