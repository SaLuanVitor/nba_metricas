"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from "recharts"
import type { SimulationResult } from "@/lib/types"

interface SimulationChartProps {
  simulation: SimulationResult
  title: string
  line?: number
  height?: number
}

export function SimulationChart({ simulation, title, line, height = 200 }: SimulationChartProps) {
  const { outcomes, distribution } = simulation
  
  // Prepara dados para o grafico
  const chartData = outcomes.map(o => ({
    value: o.value,
    probability: Math.round(o.probability * 100) / 100
  }))
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Media: <strong className="text-foreground">{distribution.mean}</strong></span>
          <span>Mediana: <strong className="text-foreground">{distribution.median}</strong></span>
          <span>Min: <strong className="text-foreground">{distribution.min}</strong></span>
          <span>Max: <strong className="text-foreground">{distribution.max}</strong></span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="value" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Probabilidade']}
              labelFormatter={(label) => `Valor: ${label}`}
            />
            {line && (
              <ReferenceLine 
                x={line} 
                stroke="hsl(var(--destructive))" 
                strokeDasharray="3 3"
                label={{ 
                  value: `Linha: ${line}`, 
                  position: 'top',
                  fontSize: 10,
                  fill: 'hsl(var(--destructive))'
                }}
              />
            )}
            <ReferenceLine 
              x={distribution.mean} 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              label={{ 
                value: `Media: ${distribution.mean}`, 
                position: 'top',
                fontSize: 10,
                fill: 'hsl(var(--primary))'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="probability" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fill="url(#simGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Percentis */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[10, 25, 75, 90].map(p => (
            <div key={p} className="text-center p-2 rounded-lg bg-secondary/30">
              <div className="text-xs text-muted-foreground">P{p}</div>
              <div className="text-sm font-semibold">{distribution.percentiles[p]}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface DistributionStatsProps {
  distribution: SimulationResult['distribution']
  compact?: boolean
}

export function DistributionStats({ distribution, compact = false }: DistributionStatsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">
          Media: <strong className="text-foreground">{distribution.mean}</strong>
        </span>
        <span className="text-muted-foreground">
          Range: <strong className="text-foreground">{distribution.min}-{distribution.max}</strong>
        </span>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-3 rounded-lg bg-secondary/30 text-center">
        <div className="text-xs text-muted-foreground">Media</div>
        <div className="text-lg font-bold">{distribution.mean}</div>
      </div>
      <div className="p-3 rounded-lg bg-secondary/30 text-center">
        <div className="text-xs text-muted-foreground">Mediana</div>
        <div className="text-lg font-bold">{distribution.median}</div>
      </div>
      <div className="p-3 rounded-lg bg-secondary/30 text-center">
        <div className="text-xs text-muted-foreground">Desvio Padrao</div>
        <div className="text-lg font-bold">{distribution.stdDev}</div>
      </div>
      <div className="p-3 rounded-lg bg-secondary/30 text-center">
        <div className="text-xs text-muted-foreground">Range</div>
        <div className="text-lg font-bold">{distribution.min} - {distribution.max}</div>
      </div>
    </div>
  )
}
