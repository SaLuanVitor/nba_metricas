import { TeamsGrid } from "@/components/teams-grid"
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

  const teamsWithConference = teams.map((team: any, idx: number) => {
    return {
      ...team,
      conference: team.conference || (idx < 15 ? 'West' : 'East'),
      wins: team.WINS || team.stats?.wins || 0,
      losses: team.LOSSES || team.stats?.losses || 0
    }
  })

  const uniqueTeamsWithConference = teamsWithConference.filter((team, index, arr) => {
    const teamKey = (team.id || team.abbreviation || team.TEAM_ABBREVIATION || team.name || "").toLowerCase()
    if (!teamKey) return false
    return index === arr.findIndex((t) => {
      const compareKey = (t.id || t.abbreviation || t.TEAM_ABBREVIATION || t.name || "").toLowerCase()
      return compareKey === teamKey
    })
  })

  const westTeams = uniqueTeamsWithConference.filter((t) => t.conference === "West")
  const eastTeams = uniqueTeamsWithConference.filter((t) => t.conference === "East")

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
      </div>
    </div>
  )
}
