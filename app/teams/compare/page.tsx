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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes, playersRes] = await Promise.all([fetch("/api/teams"), fetch("/api/players")])
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
        if (fetchedTeams[0]) setTeam1Id(fetchedTeams[0].id)
        if (fetchedTeams[1]) setTeam2Id(fetchedTeams[1].id)
      } catch (err: any) {
        setError(err.message || "Erro ao carregar comparacao")
      } finally {
        setLoading(false)
      }
    }

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
    const val1 = team1.stats[stat.key as keyof typeof team1.stats]
    const val2 = team2.stats[stat.key as keyof typeof team2.stats]
    if (val1 === val2) return "tie"
    if (stat.better === "higher") return val1 > val2 ? "team1" : "team2"
    return val1 < val2 ? "team1" : "team2"
  }

  if (loading) {
    return <div className="text-muted-foreground">Carregando comparacao de times...</div>
  }

  if (error) {
    return <div className="text-red-400">Erro: {error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Comparar Times</h1>
        <p className="text-muted-foreground mt-1">
          Compare estatisticas completas entre dois times da NBA
        </p>
      </div>

      {/* Team Selection */}
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
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: team.primaryColor }}
                        />
                        {team.city} {team.name}
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
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: team.primaryColor }}
                        />
                        {team.city} {team.name}
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
          {/* Team Headers */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="h-14 w-14 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: team1.primaryColor }}
                  >
                    {team1.abbreviation}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {team1.city} {team1.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {team1.stats.wins}-{team1.stats.losses}
                      </Badge>
                      <Badge variant="secondary">
                        #{team1.rank.conference} {team1.conference}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="h-14 w-14 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: team2.primaryColor }}
                  >
                    {team2.abbreviation}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {team2.city} {team2.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {team2.stats.wins}-{team2.stats.losses}
                      </Badge>
                      <Badge variant="secondary">
                        #{team2.rank.conference} {team2.conference}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparacao Visual</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamComparisonRadar team1={team1} team2={team2} />
            </CardContent>
          </Card>

          {/* Stats Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Comparacao de Estatisticas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-1/3">{team1.abbreviation}</TableHead>
                    <TableHead className="text-center">Estatistica</TableHead>
                    <TableHead className="w-1/3">{team2.abbreviation}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compareStats.map((stat) => {
                    const winner = getWinner(stat)
                    const val1 = team1.stats[stat.key as keyof typeof team1.stats]
                    const val2 = team2.stats[stat.key as keyof typeof team2.stats]
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
                            {typeof val1 === "number" ? val1.toFixed(1) : val1}
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
                            {typeof val2 === "number" ? val2.toFixed(1) : val2}
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

          {/* Roster Comparison */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div
                    className="h-5 w-5 rounded"
                    style={{ backgroundColor: team1.primaryColor }}
                  />
                  Elenco {team1.abbreviation}
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
                      .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                      .map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {player.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedPoints.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedAssists.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedRebounds.toFixed(1)}
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
                  <div
                    className="h-5 w-5 rounded"
                    style={{ backgroundColor: team2.primaryColor }}
                  />
                  Elenco {team2.abbreviation}
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
                      .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                      .map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {player.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedPoints.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedAssists.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.projection.projectedRebounds.toFixed(1)}
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
