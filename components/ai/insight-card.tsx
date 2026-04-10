"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfidenceBadge } from "./confidence-badge"
import type { AIInsight } from "@/lib/types"
import { cn } from "@/lib/utils"
import { 
  AlertTriangle, 
  TrendingUp, 
  User, 
  Users, 
  Swords, 
  Info,
  CheckCircle,
  XCircle
} from "lucide-react"

interface InsightCardProps {
  insight: AIInsight
  onClick?: () => void
}

const typeIcons = {
  player: User,
  team: Users,
  matchup: Swords,
  trend: TrendingUp,
  alert: AlertTriangle
}

const severityStyles = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: Info,
    iconColor: "text-blue-400"
  },
  warning: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    icon: AlertTriangle,
    iconColor: "text-yellow-400"
  },
  positive: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    icon: CheckCircle,
    iconColor: "text-emerald-400"
  },
  negative: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    icon: XCircle,
    iconColor: "text-red-400"
  }
}

export function InsightCard({ insight, onClick }: InsightCardProps) {
  const TypeIcon = typeIcons[insight.type]
  const severity = severityStyles[insight.severity]
  const SeverityIcon = severity.icon
  
  return (
    <Card 
      className={cn(
        "border transition-all duration-200",
        severity.border,
        severity.bg,
        onClick && "cursor-pointer hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md", severity.bg)}>
              <SeverityIcon className={cn("h-4 w-4", severity.iconColor)} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TypeIcon className="h-3 w-3" />
              <span className="capitalize">{insight.type}</span>
            </div>
          </div>
          <ConfidenceBadge level={insight.confidence} showLabel={false} size="sm" />
        </div>
        <CardTitle className="text-base mt-2">{insight.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {insight.description}
        </p>
        {insight.factors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insight.factors.slice(0, 3).map((factor, idx) => (
              <span 
                key={idx}
                className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
              >
                {factor}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface InsightListProps {
  insights: AIInsight[]
  maxItems?: number
  onInsightClick?: (insight: AIInsight) => void
}

export function InsightList({ insights, maxItems = 5, onInsightClick }: InsightListProps) {
  const displayInsights = insights.slice(0, maxItems)
  
  return (
    <div className="space-y-3">
      {displayInsights.map(insight => (
        <InsightCard 
          key={insight.id} 
          insight={insight}
          onClick={onInsightClick ? () => onInsightClick(insight) : undefined}
        />
      ))}
      {insights.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum insight disponivel no momento
        </div>
      )}
    </div>
  )
}
