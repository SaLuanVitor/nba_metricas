import { getConferenceByAbbreviation } from "@/lib/nba/team-metadata"
import type { Player, TeamWithStats } from "@/lib/types"

function toRecord(parts?: string[]): string {
  if (!parts?.length) return "0-0"
  const wins = parts.filter((x) => x === "W").length
  const losses = Math.max(0, parts.length - wins)
  return `${wins}-${losses}`
}

export function buildFallbackTeamsFromPlayers(players: Player[]): TeamWithStats[] {
  const groups = new Map<string, Player[]>()

  for (const player of players || []) {
    const team = player.team
    if (!team) continue
    const key = String(team.id || team.abbreviation || "").toLowerCase()
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(player)
  }

  const teams: TeamWithStats[] = []
  for (const [key, roster] of groups.entries()) {
    const sample = roster[0]?.team
    if (!sample) continue

    const avg = (fn: (p: Player) => number) =>
      roster.length ? roster.reduce((s, p) => s + fn(p), 0) / roster.length : 0

    const ppg = avg((p) => Number(p.seasonStats?.points || 0))
    const apg = avg((p) => Number(p.seasonStats?.assists || 0))
    const rpg = avg((p) => Number(p.seasonStats?.rebounds || 0))
    const spg = avg((p) => Number(p.seasonStats?.steals || 0))
    const bpg = avg((p) => Number(p.seasonStats?.blocks || 0))
    const tpg = avg((p) => Number(p.seasonStats?.turnovers || 0))
    const fgp = avg((p) => Number(p.seasonStats?.fieldGoalPercentage || 0))
    const tpp = avg((p) => Number(p.seasonStats?.threePointPercentage || 0))
    const ftp = avg((p) => Number(p.seasonStats?.freeThrowPercentage || 0))

    const wins = 0
    const losses = 0
    const conference = getConferenceByAbbreviation(sample.abbreviation) || "East"
    const lastGames: ("W" | "L")[] = []

    teams.push({
      id: String(sample.id || key),
      name: String(sample.name || sample.abbreviation || "NBA"),
      abbreviation: String(sample.abbreviation || "NBA"),
      logoUrl: String(sample.logoUrl || ""),
      city: String(sample.city || ""),
      conference,
      division: String(sample.division || "Unknown"),
      primaryColor: String(sample.primaryColor || "#1D428A"),
      secondaryColor: String(sample.secondaryColor || "#C8102E"),
      stats: {
        wins,
        losses,
        pointsPerGame: Number(ppg.toFixed(1)),
        assistsPerGame: Number(apg.toFixed(1)),
        reboundsPerGame: Number(rpg.toFixed(1)),
        stealsPerGame: Number(spg.toFixed(1)),
        blocksPerGame: Number(bpg.toFixed(1)),
        turnoversPerGame: Number(tpg.toFixed(1)),
        fieldGoalPercentage: Number(fgp.toFixed(1)),
        threePointPercentage: Number(tpp.toFixed(1)),
        freeThrowPercentage: Number(ftp.toFixed(1)),
        offensiveRating: Number((ppg + apg * 0.5).toFixed(1)),
        defensiveRating: Number((110 - (spg + bpg * 0.3)).toFixed(1)),
        pace: Number((95 + Math.min(10, rpg * 0.2)).toFixed(1)),
      },
      streak: "N0",
      lastGames,
      rank: {
        conference: 0,
        overall: 0,
      },
      record: {
        winPct: 0,
        gamesPlayed: wins + losses,
        last10: toRecord(lastGames),
        streak: "N0",
      },
    })
  }

  return teams
}
