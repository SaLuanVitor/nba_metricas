import { cn } from "@/lib/utils"
import { getTrendColor } from "@/lib/ai-experts"
import type { TrendDirection } from "@/lib/types"
import { TrendingUp, TrendingDown, Minus, ChevronsUp, ChevronsDown } from "lucide-react"

interface TrendIndicatorProps {
  direction: TrendDirection
  magnitude?: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

const trendLabels: Record<TrendDirection, string> = {
  "strong-up": "Forte Alta",
  "up": "Em Alta",
  "stable": "Estavel",
  "down": "Em Baixa",
  "strong-down": "Forte Queda"
}

const trendIcons: Record<TrendDirection, React.ElementType> = {
  "strong-up": ChevronsUp,
  "up": TrendingUp,
  "stable": Minus,
  "down": TrendingDown,
  "strong-down": ChevronsDown
}

const trendBgColors: Record<TrendDirection, string> = {
  "strong-up": "bg-emerald-500/20",
  "up": "bg-green-500/20",
  "stable": "bg-gray-500/20",
  "down": "bg-orange-500/20",
  "strong-down": "bg-red-500/20"
}

export function TrendIndicator({ 
  direction, 
  magnitude,
  showLabel = false, 
  size = "md" 
}: TrendIndicatorProps) {
  const Icon = trendIcons[direction]
  
  const sizes = {
    sm: "text-xs gap-0.5",
    md: "text-sm gap-1",
    lg: "text-base gap-1.5"
  }
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }
  
  const padding = {
    sm: "px-1.5 py-0.5",
    md: "px-2 py-1",
    lg: "px-2.5 py-1.5"
  }
  
  return (
    <span className={cn(
      "inline-flex items-center rounded-md font-medium",
      getTrendColor(direction),
      trendBgColors[direction],
      sizes[size],
      padding[size]
    )}>
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{trendLabels[direction]}</span>}
      {magnitude !== undefined && (
        <span className="opacity-80">{magnitude}%</span>
      )}
    </span>
  )
}

interface TrendArrowProps {
  direction: TrendDirection
  size?: "sm" | "md" | "lg"
}

export function TrendArrow({ direction, size = "md" }: TrendArrowProps) {
  const Icon = trendIcons[direction]
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }
  
  return (
    <Icon className={cn(iconSizes[size], getTrendColor(direction))} />
  )
}

interface SimpleTrendBadgeProps {
  value: number // positivo = up, negativo = down, proximo de 0 = stable
  suffix?: string
}

export function SimpleTrendBadge({ value, suffix = "%" }: SimpleTrendBadgeProps) {
  const direction: TrendDirection = 
    value > 10 ? "strong-up" :
    value > 3 ? "up" :
    value > -3 ? "stable" :
    value > -10 ? "down" : "strong-down"
  
  const Icon = trendIcons[direction]
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
      getTrendColor(direction),
      trendBgColors[direction]
    )}>
      <Icon className="h-3 w-3" />
      {value > 0 && "+"}{value.toFixed(1)}{suffix}
    </span>
  )
}
