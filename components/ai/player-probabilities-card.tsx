"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProbabilityBar, DualProbabilityBar } from "./probability-bar"
import { ConfidenceBadge } from "./confidence-badge"
import type { PlayerProbabilities } from "@/lib/types"
import { Target, Percent, Trophy } from "lucide-react"

interface PlayerProbabilitiesCardProps {
  probabilities: PlayerProbabilities
  playerName: string
}

export function PlayerProbabilitiesCard({ probabilities, playerName }: PlayerProbabilitiesCardProps) {
  const { overUnder, doubleDouble, tripleDouble, season30Plus } = probabilities
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Probabilidades - {playerName}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="over-under" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="over-under" className="flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" />
              Over/Under
            </TabsTrigger>
            <TabsTrigger value="props" className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Props
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="over-under" className="space-y-5">
            <DualProbabilityBar 
              overLabel="Over"
              underLabel="Under"
              overProb={overUnder.points.overProb.value}
              underProb={overUnder.points.underProb.value}
              line={overUnder.points.line}
            />
            <div className="text-xs text-center text-muted-foreground -mt-2">Pontos</div>
            
            <DualProbabilityBar 
              overLabel="Over"
              underLabel="Under"
              overProb={overUnder.assists.overProb.value}
              underProb={overUnder.assists.underProb.value}
              line={overUnder.assists.line}
            />
            <div className="text-xs text-center text-muted-foreground -mt-2">Assistencias</div>
            
            <DualProbabilityBar 
              overLabel="Over"
              underLabel="Under"
              overProb={overUnder.rebounds.overProb.value}
              underProb={overUnder.rebounds.underProb.value}
              line={overUnder.rebounds.line}
            />
            <div className="text-xs text-center text-muted-foreground -mt-2">Rebotes</div>
            
            <DualProbabilityBar 
              overLabel="Over"
              underLabel="Under"
              overProb={overUnder.minutes.overProb.value}
              underProb={overUnder.minutes.underProb.value}
              line={overUnder.minutes.line}
            />
            <div className="text-xs text-center text-muted-foreground -mt-2">Minutos</div>
            
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Confianca geral</span>
                <ConfidenceBadge level={overUnder.points.overProb.confidence} size="sm" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="props" className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Double-Double</span>
                  <ConfidenceBadge level={doubleDouble.confidence} showLabel={false} size="sm" />
                </div>
                <ProbabilityBar 
                  label="Probabilidade" 
                  probability={doubleDouble.value}
                  size="lg"
                />
                <div className="text-xs text-muted-foreground">
                  {doubleDouble.factors.map(f => f.description).join(" | ")}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Triple-Double</span>
                  <ConfidenceBadge level={tripleDouble.confidence} showLabel={false} size="sm" />
                </div>
                <ProbabilityBar 
                  label="Probabilidade" 
                  probability={tripleDouble.value}
                  size="lg"
                />
                <div className="text-xs text-muted-foreground">
                  {tripleDouble.factors.map(f => f.description).join(" | ")}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">30+ Pontos</span>
                  <ConfidenceBadge level={season30Plus.confidence} showLabel={false} size="sm" />
                </div>
                <ProbabilityBar 
                  label="Probabilidade" 
                  probability={season30Plus.value}
                  size="lg"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
