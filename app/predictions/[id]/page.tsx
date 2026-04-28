import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, Clock, Database, Scale, ShieldAlert, Target, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { getPredictionById } from "@/lib/predictions/registry"
import type { AuditablePrediction, PredictionMarket, RiskLevel, SettlementStatus } from "@/lib/predictions/contracts"

type Props = {
  params: Promise<{ id: string }>
}

const marketLabels: Record<PredictionMarket, string> = {
  player_points: "Pontos",
  player_assists: "Assistencias",
  player_rebounds: "Rebotes",
}

const riskLabels: Record<RiskLevel, string> = {
  baixo: "Baixo",
  medio: "Medio",
  alto: "Alto",
}

const settlementLabels: Record<SettlementStatus, string> = {
  pending: "Pendente",
  won: "Ganha",
  lost: "Perdida",
  push: "Push",
  void: "Void",
}

function pct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  return `${Number(value).toFixed(digits)}%`
}

function signedPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  const n = Number(value) * 100
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

function units(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  const n = Number(value)
  return `${n >= 0 ? "+" : ""}${n.toFixed(3)}u`
}

function numberText(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-"
  return Number(value).toFixed(digits)
}

function dateText(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" })
}

function statusIcon(status: SettlementStatus) {
  if (status === "won") return <CheckCircle2 className="h-4 w-4" />
  if (status === "lost") return <XCircle className="h-4 w-4" />
  return <Clock className="h-4 w-4" />
}

function statusVariant(status: SettlementStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "won") return "default"
  if (status === "lost") return "destructive"
  if (status === "push" || status === "void") return "secondary"
  return "outline"
}

function riskVariant(risk: RiskLevel): "default" | "secondary" | "destructive" | "outline" {
  if (risk === "alto") return "destructive"
  if (risk === "baixo") return "secondary"
  return "outline"
}

function projectionForMarket(prediction: AuditablePrediction) {
  const projection = prediction.inputSnapshot.playerProjection
  if (prediction.market === "player_points") return projection.projectedPoints
  if (prediction.market === "player_assists") return projection.projectedAssists
  return projection.projectedRebounds
}

export default async function PredictionAuditPage({ params }: Props) {
  const { id } = await params
  const prediction = await getPredictionById(id)

  if (!prediction) {
    notFound()
  }

  const input = prediction.inputSnapshot
  const output = prediction.output
  const outcome = prediction.outcome
  const probabilityValue = Math.max(0, Math.min(100, Number(output.probability || 0)))
  const projection = projectionForMarket(prediction)
  const seasonStats = Object.entries(input.seasonStats || {}).filter(([, value]) => Number.isFinite(Number(value)))
  const marketSnapshot = input.marketSnapshot

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="w-fit gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/today">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Hoje
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{marketLabels[prediction.market]}</Badge>
              <Badge variant={riskVariant(output.riskLevel)}>Risco {riskLabels[output.riskLevel]}</Badge>
              <Badge variant={statusVariant(outcome.status)} className="gap-1">
                {statusIcon(outcome.status)}
                {settlementLabels[outcome.status]}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground">
              Auditoria de {input.playerName}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Registro auditavel da previsao, com snapshot de entrada, output do modelo, fatores, risco e settlement.
            </p>
          </div>
        </div>
        <Card className="lg:w-80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Identificacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="break-all font-mono text-xs text-muted-foreground">{prediction.id}</div>
            <div>Modelo: {prediction.modelVersion}</div>
            <div>Criada: {dateText(prediction.createdAt)}</div>
            <div>Expira: {dateText(prediction.expiresAt)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pick</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{prediction.side.toUpperCase()} {numberText(prediction.line)}</div>
            <div className="text-sm text-muted-foreground">{marketLabels[prediction.market]}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Probabilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pct(output.probability)}</div>
            <Progress value={probabilityValue} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Edge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{signedPct(output.edge)}</div>
            <div className="text-sm text-muted-foreground">EV {units(output.expectedValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Outcome</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{settlementLabels[outcome.status]}</div>
            <div className="text-sm text-muted-foreground">Real {numberText(outcome.actualValue)}</div>
          </CardContent>
        </Card>
      </div>

      {outcome.status === "pending" && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Previsao ainda sem settlement</AlertTitle>
          <AlertDescription>
            A acuracia final depende do boxscore final e do job de settlement. Antes disso, esta tela mostra apenas a tese original.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Razoes e fatores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!!output.reasons?.length && (
                <div className="rounded-md bg-secondary/30 p-3 text-sm text-muted-foreground">
                  <div className="mb-2 font-medium text-foreground">Resumo explicavel</div>
                  <ul className="list-inside list-disc space-y-1">
                    {output.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              )}
              <div className="space-y-3">
                {output.factors.map((factor) => (
                  <div key={`${factor.name}-${factor.weight}`} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{factor.name}</div>
                      <Badge variant={factor.impact >= 0 ? "secondary" : "outline"}>
                        Impacto {factor.impact >= 0 ? "+" : ""}{factor.impact}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{factor.description}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={Math.max(0, Math.min(100, Math.abs(factor.weight) * 100))} />
                      <span className="w-16 text-right text-xs text-muted-foreground">Peso {pct(Math.abs(factor.weight) * 100, 0)}</span>
                    </div>
                  </div>
                ))}
                {!output.factors.length && <div className="text-sm text-muted-foreground">Nenhum fator registrado para esta previsao.</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Snapshot de entrada
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="font-medium">Contexto</div>
                <div>Jogo: {input.gameId}</div>
                <div>Jogador: {input.playerName}</div>
                <div>Time: {input.team || "-"}</div>
                <div>Oponente: {input.opponent || "-"}</div>
                <div>Gerado em: {dateText(input.generatedAt)}</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="font-medium">Linha e odds</div>
                <div>Sportsbook: {input.sportsbook || marketSnapshot?.sportsbook || "-"}</div>
                <div>American odds: {input.americanOdds ?? marketSnapshot?.americanOdds ?? "-"}</div>
                <div>Projection: {numberText(projection)}</div>
                <div>Conf. projection: {pct(input.playerProjection.confidence)}</div>
                <div>Snapshot odds: {marketSnapshot ? dateText(marketSnapshot.timestamp) : "-"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4" />
                Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={statusVariant(outcome.status)}>{settlementLabels[outcome.status]}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Valor real</span>
                <span>{numberText(outcome.actualValue)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Erro absoluto</span>
                <span>{numberText(outcome.errorAbs)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">ROI</span>
                <span>{units(outcome.roiUnits)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Brier</span>
                <span>{numberText(outcome.brierScore, 4)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Liquidado em</span>
                <span>{dateText(outcome.settledAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats de temporada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {seasonStats.slice(0, 10).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{key}</span>
                  <span>{numberText(Number(value), 2)}</span>
                </div>
              ))}
              {!seasonStats.length && <div className="text-muted-foreground">Sem stats de temporada no snapshot.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
