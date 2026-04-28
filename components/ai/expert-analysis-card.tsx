"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfidenceMeter } from "./confidence-badge"
import type { ExpertAnalysis } from "@/lib/types"
import { 
  Zap, 
  AlertCircle, 
  Lightbulb, 
  Shield,
  ChevronRight,
  Bot
} from "lucide-react"

interface ExpertAnalysisCardProps {
  analysis: ExpertAnalysis
  entityName: string
  compact?: boolean
}

export function ExpertAnalysisCard({ analysis, entityName, compact = false }: ExpertAnalysisCardProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Analise de IA</CardTitle>
              <p className="text-xs text-muted-foreground">{entityName}</p>
            </div>
          </div>
          <ConfidenceMeter score={analysis.confidenceScore} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <p className="text-sm text-foreground/90 leading-relaxed">
          {analysis.summary}
        </p>
        
        {!compact && (
          <>
            {/* SWOT Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Strengths */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Forcas</span>
                </div>
                <ul className="space-y-1">
                  {analysis.strengths.slice(0, 3).map((s, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Weaknesses */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Fraquezas</span>
                </div>
                <ul className="space-y-1">
                  {analysis.weaknesses.slice(0, 3).map((w, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                  {analysis.weaknesses.length === 0 && (
                    <li className="text-xs text-muted-foreground/50 italic">Nenhuma identificada</li>
                  )}
                </ul>
              </div>
              
              {/* Opportunities */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Oportunidades</span>
                </div>
                <ul className="space-y-1">
                  {analysis.opportunities.slice(0, 3).map((o, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
                      <span>{o}</span>
                    </li>
                  ))}
                  {analysis.opportunities.length === 0 && (
                    <li className="text-xs text-muted-foreground/50 italic">Nenhuma identificada</li>
                  )}
                </ul>
              </div>
              
              {/* Threats */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-orange-400">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Ameacas</span>
                </div>
                <ul className="space-y-1">
                  {analysis.threats.slice(0, 3).map((t, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-orange-500 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                  {analysis.threats.length === 0 && (
                    <li className="text-xs text-muted-foreground/50 italic">Nenhuma identificada</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
        
        {/* Recommendation */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Recomendacao</span>
              <p className="text-sm text-foreground/90 mt-0.5">{analysis.recommendation}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
