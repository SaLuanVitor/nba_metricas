import { cn } from "@/lib/utils"
import { getConfidenceBgColor, getConfidenceColor } from "@/lib/probability-engine"
import type { ConfidenceLevel } from "@/lib/types"
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"

interface ConfidenceBadgeProps {
  level: ConfidenceLevel
  score?: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

const levelLabels: Record<ConfidenceLevel, string> = {
  "very-high": "Muito Alta",
  "high": "Alta",
  "medium": "Media",
  "low": "Baixa",
  "very-low": "Muito Baixa"
}

const levelIcons: Record<ConfidenceLevel, React.ElementType> = {
  "very-high": ShieldCheck,
  "high": ShieldCheck,
  "medium": Shield,
  "low": ShieldQuestion,
  "very-low": ShieldAlert
}

export function ConfidenceBadge({ 
  level, 
  score,
  showLabel = true, 
  size = "md" 
}: ConfidenceBadgeProps) {
  const Icon = levelIcons[level]
  
  const sizes = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2"
  }
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }
  
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border font-medium",
      getConfidenceBgColor(level),
      getConfidenceColor(level),
      sizes[size]
    )}>
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{levelLabels[level]}</span>}
      {score !== undefined && (
        <span className="opacity-70">({score}%)</span>
      )}
    </span>
  )
}

interface ConfidenceMeterProps {
  score: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

export function ConfidenceMeter({ score, showLabel = true, size = "md" }: ConfidenceMeterProps) {
  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3"
  }
  
  const getColor = (s: number) => {
    if (s >= 85) return "bg-emerald-500"
    if (s >= 70) return "bg-green-500"
    if (s >= 50) return "bg-yellow-500"
    if (s >= 30) return "bg-orange-500"
    return "bg-red-500"
  }
  
  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confianca</span>
          <span className="font-semibold">{score}%</span>
        </div>
      )}
      <div className={cn("w-full bg-secondary/50 rounded-full overflow-hidden", heights[size])}>
        <div 
          className={cn("h-full rounded-full transition-all duration-700", getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
