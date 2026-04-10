import { NextResponse } from 'next/server';
import { generateInsights } from '@/lib/ai/engine';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

function toConfidenceLevel(score: number): 'very-low' | 'low' | 'medium' | 'high' | 'very-high' {
  if (score >= 85) return 'very-high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'very-low';
}

export async function GET() {
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getPlayers(season);

  const insights = playersResult.data.slice(0, 20).flatMap((player) =>
    generateInsights(player).map((description, idx) => ({
      id: `${player.id}-insight-${idx + 1}`,
      type: 'player',
      severity: 'info',
      title: `${player.name} insight`,
      description,
      confidence: toConfidenceLevel(player.projection?.confidence || 50),
      entityType: 'player',
      entityId: player.id,
      trend: player.projection?.trend || 'stable',
      factors: [player.team?.abbreviation || 'NBA'],
    }))
  );

  return NextResponse.json({
    success: true,
    data: insights,
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: playersResult.warning,
    errorCode: playersResult.errorCode,
    total: insights.length,
  });
}
