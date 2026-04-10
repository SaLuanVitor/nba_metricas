import { TeamsGrid } from "@/components/teams-grid"
import { getConferenceByAbbreviation } from "@/lib/nba/team-metadata"
import { headers } from "next/headers"

export const metadata = {
  title: "Times NBA - Estatisticas e Rankings",
  description: "Veja as estatisticas completas de todos os times da NBA",
}

async function getData() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") || headerList.get("host")
  const protocol = headerList.get("x-forwarded-proto") || "http"
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (host ? `${protocol}://${host}` : "http://localhost:3000")

  const teamsRes = await fetch(`${baseUrl}/api/teams`, {
    next: { revalidate: 60 }
  })

  const teamsData = await teamsRes.json()
  
  if (!teamsData.success) {
    throw new Error(teamsData.error || 'Failed to fetch teams')
  }
  
  return {
    teams: teamsData.data || []
  }
}

export default async function TeamsPage() {
  let teams: any[] = []
  
  try {
    const data = await getData()
    teams = data.teams
  } catch (error) {
    console.error('Error fetching teams:', error)
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Times NBA</h1>
        </div>
        <div className="text-red-400">Erro ao carregar dados: API indisponivel</div>
      </div>
    )
  }

  const normalizedTeams = teams.map((team: any) => {
    const abbreviation = String(team.abbreviation || team.TEAM_ABBREVIATION || "").toUpperCase()
    const canonicalConference = getConferenceByAbbreviation(abbreviation)
    const rawConference = String(team.conference || "").toLowerCase()
    const conference =
      canonicalConference ||
      (rawConference === "east" || rawConference === "west"
        ? (rawConference[0].toUpperCase() + rawConference.slice(1))
        : "Unknown")

    const wins = Number(team?.stats?.wins ?? team?.WINS ?? 0)
    const losses = Number(team?.stats?.losses ?? team?.LOSSES ?? 0)
    const gamesPlayed = Math.max(0, wins + losses)
    const winPct = gamesPlayed > 0 ? wins / gamesPlayed : 0
    const last10Array = Array.isArray(team?.lastGames) ? team.lastGames.slice(-10) : []
    const last10Wins = last10Array.filter((x: string) => x === "W").length
    const last10Losses = Math.max(0, last10Array.length - last10Wins)

    return {
      ...team,
      conference,
      stats: {
        ...team.stats,
        wins,
        losses,
      },
      streak: team.streak || team?.record?.streak || "N0",
      record: {
        winPct: Number((team?.record?.winPct ?? winPct).toFixed(3)),
        gamesPlayed,
        last10: team?.record?.last10 || `${last10Wins}-${last10Losses}`,
        streak: team?.record?.streak || team.streak || "N0",
      },
    }
  })

  const deduped = new Map<string, any>()
  for (const team of normalizedTeams) {
    const key = String(team.id || team.abbreviation || team.name || "").toLowerCase()
    if (!key) continue
    if (!deduped.has(key)) {
      deduped.set(key, team)
    }
  }

  const uniqueTeamsWithConference = Array.from(deduped.values())
  const westTeams = uniqueTeamsWithConference.filter((t) => t.conference === "West")
  const eastTeams = uniqueTeamsWithConference.filter((t) => t.conference === "East")
  const unknownConferenceTeams = uniqueTeamsWithConference.filter(
    (t) => t.conference !== "West" && t.conference !== "East"
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Times NBA</h1>
        <p className="text-muted-foreground mt-1">
          Estatisticas completas e rankings de todos os times
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            Conferencia Oeste
          </h2>
          <TeamsGrid teams={westTeams} />
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Conferencia Leste
          </h2>
          <TeamsGrid teams={eastTeams} />
        </section>

        {unknownConferenceTeams.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              Conferencia Indefinida
            </h2>
            <TeamsGrid teams={unknownConferenceTeams} />
          </section>
        )}
      </div>
    </div>
  )
}
