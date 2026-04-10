import { PlayersTable } from "@/components/players-table"

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Jogadores</h1>
        <p className="text-muted-foreground mt-1">
          Lista completa de jogadores com projecoes e estatisticas
        </p>
      </div>

      <PlayersTable />
    </div>
  )
}
