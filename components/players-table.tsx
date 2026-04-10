"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Position, SortDirection } from "@/lib/types"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  AlertCircle,
} from "lucide-react"

type SortField = "name" | "points" | "assists" | "rebounds" | "minutes" | "fantasyPoints"

interface Player {
  id: string
  name: string
  firstName: string
  lastName: string
  position: string
  team: {
    id: string
    name: string
    abbreviation: string
    primaryColor?: string
  }
  projection: {
    projectedPoints: number
    projectedAssists: number
    projectedRebounds: number
    projectedMinutes: number
    trend: string
  }
  injury?: string
}

export function PlayersTable() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<{id: string, name: string, abbreviation: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState("")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [positionFilter, setPositionFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("points")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  useEffect(() => {
    async function fetchData() {
      try {
        const [playersRes, teamsRes] = await Promise.all([
          fetch('/api/players'),
          fetch('/api/teams')
        ])

        const playersData = await playersRes.json()
        const teamsData = await teamsRes.json()

        if (!playersData.success) {
          throw new Error(playersData.error || 'Players API failed')
        }
        if (!teamsData.success) {
          throw new Error(teamsData.error || 'Teams API failed')
        }

        setPlayers(playersData.data || [])
        setTeams(teamsData.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players]

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.team.name.toLowerCase().includes(searchLower)
      )
    }

    if (teamFilter !== "all") {
      result = result.filter(
        (p) => (p.team.id || p.team.abbreviation || p.team.name || "").toLowerCase() === teamFilter
      )
    }

    if (positionFilter !== "all") {
      result = result.filter((p) => p.position === positionFilter)
    }

    result.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortField) {
        case "name":
          return sortDirection === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name)
        case "points":
          aValue = a.projection?.projectedPoints || 0
          bValue = b.projection?.projectedPoints || 0
          break
        case "assists":
          aValue = a.projection?.projectedAssists || 0
          bValue = b.projection?.projectedAssists || 0
          break
        case "rebounds":
          aValue = a.projection?.projectedRebounds || 0
          bValue = b.projection?.projectedRebounds || 0
          break
        case "minutes":
          aValue = a.projection?.projectedMinutes || 0
          bValue = b.projection?.projectedMinutes || 0
          break
        default:
          return 0
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })

    return result
  }, [players, search, teamFilter, positionFilter, sortField, sortDirection])

  const uniqueTeams = useMemo(() => {
    const seenValues = new Set<string>()
    const deduped: { id: string; name: string; abbreviation: string; optionValue: string }[] = []

    for (const team of teams) {
      const optionValue = (team.id || team.abbreviation || team.name || "").toLowerCase()
      if (!optionValue || seenValues.has(optionValue)) continue
      seenValues.add(optionValue)
      deduped.push({ ...team, optionValue })
    }

    return deduped
  }, [teams])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
  }

  const positions: Position[] = ["PG", "SG", "SF", "PF", "C"]

  if (loading) {
    return <div className="text-muted-foreground">Carregando jogadores...</div>
  }

  if (error) {
    return <div className="text-red-400">Erro: {error}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jogador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os times</SelectItem>
            {uniqueTeams.map((team, index) => (
              <SelectItem key={`${team.optionValue}-${index}`} value={team.optionValue}>
                {team.abbreviation} - {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-full sm:w-[140px] bg-secondary border-border">
            <SelectValue placeholder="Posicao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {positions.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("name")}
                  className="font-medium text-muted-foreground hover:text-foreground -ml-3"
                >
                  Jogador
                  <SortIcon field="name" />
                </Button>
              </TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">Time</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Pos</TableHead>
              <TableHead className="text-muted-foreground text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("points")}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Pts
                  <SortIcon field="points" />
                </Button>
              </TableHead>
              <TableHead className="text-muted-foreground text-right hidden sm:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("assists")}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Ast
                  <SortIcon field="assists" />
                </Button>
              </TableHead>
              <TableHead className="text-muted-foreground text-right hidden sm:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("rebounds")}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Reb
                  <SortIcon field="rebounds" />
                </Button>
              </TableHead>
              <TableHead className="text-muted-foreground text-right hidden lg:table-cell">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("minutes")}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Min
                  <SortIcon field="minutes" />
                </Button>
              </TableHead>
              <TableHead className="text-muted-foreground text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPlayers.map((player) => (
              <TableRow
                key={player.id}
                className="hover:bg-secondary/30 cursor-pointer"
              >
                <TableCell>
                  <Link href={`/players/${player.id}`} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground"
                      style={{ backgroundColor: (player.team.primaryColor || '#333') + "33" }}
                    >
                      {player.firstName?.[0]}{player.lastName?.[0]}
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {player.name}
                        {player.injury && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {player.team.abbreviation} - {player.position}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {player.team.abbreviation}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {player.position}
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {(player.projection?.projectedPoints || 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                  {(player.projection?.projectedAssists || 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                  {(player.projection?.projectedRebounds || 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground hidden lg:table-cell">
                  {(player.projection?.projectedMinutes || 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-center">
                  {player.projection?.trend === "up" && (
                    <TrendingUp className="h-4 w-4 text-green-500 inline-block" />
                  )}
                  {player.projection?.trend === "down" && (
                    <TrendingDown className="h-4 w-4 text-red-500 inline-block" />
                  )}
                  {player.projection?.trend === "stable" && (
                    <Minus className="h-4 w-4 text-muted-foreground inline-block" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Mostrando {filteredAndSortedPlayers.length} de {players.length} jogadores
      </div>
    </div>
  )
}
