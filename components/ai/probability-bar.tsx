"use client"

import { cn } from "@/lib/utils"
import { getProbabilityBgClass } from "@/lib/probability-engine"

interface ProbabilityBarProps {
  label: string
  probability: number
  line?: number
  showValue?: boolean
  size?: "sm" | "md" | "lg"
  animated?: boolean
}

export function ProbabilityBar({ 
  label, 
  probability, 
  line,
  showValue = true,
  size = "md",
  animated = true
}: ProbabilityBarProps) {
  const heights = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4"
  }
  
  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }
  
  return (
    <div className="space-y-1.5">
      <div className={cn("flex items-center justify-between", textSizes[size])}>
        <span className="text-muted-foreground">
          {label}
          {line && <span className="text-foreground/70 ml-1">({line})</span>}
        </span>
        {showValue && (
          <span className={cn(
            "font-semibold tabular-nums",
            probability >= 60 ? "text-emerald-400" : 
            probability >= 45 ? "text-yellow-400" : "text-red-400"
          )}>
            {probability}%
          </span>
        )}
      </div>
      <div className={cn("w-full bg-secondary/50 rounded-full overflow-hidden", heights[size])}>
        <div 
          className={cn(
            "h-full rounded-full transition-all",
            getProbabilityBgClass(probability),
            animated && "duration-1000 ease-out"
          )}
          style={{ 
            width: animated ? `${probability}%` : `${probability}%`,
          }}
        />
      </div>
    </div>
  )
}

interface DualProbabilityBarProps {
  overLabel: string
  underLabel: string
  overProb: number
  underProb: number
  line: number
}

export function DualProbabilityBar({
  overLabel,
  underLabel,
  overProb,
  underProb,
  line
}: DualProbabilityBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{overLabel}</span>
        <span className="font-medium text-foreground/80">Linha: {line}</span>
        <span className="text-muted-foreground">{underLabel}</span>
      </div>
      <div className="flex h-6 rounded-full overflow-hidden bg-secondary/30">
        <div 
          className="flex items-center justify-start pl-2 bg-emerald-500/80 text-xs font-semibold text-emerald-950 transition-all duration-1000"
          style={{ width: `${overProb}%` }}
        >
          {overProb > 20 && `${overProb}%`}
        </div>
        <div 
          className="flex items-center justify-end pr-2 bg-red-500/80 text-xs font-semibold text-red-950 transition-all duration-1000"
          style={{ width: `${underProb}%` }}
        >
          {underProb > 20 && `${underProb}%`}
        </div>
      </div>
    </div>
  )
}
