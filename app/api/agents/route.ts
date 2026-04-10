import { NextResponse } from 'next/server';
import { ensureAgentsInitialized, listAgents } from '@/lib/ai/agents-service';

export async function GET() {
  const init = await ensureAgentsInitialized();
  const agents = listAgents();

  return NextResponse.json({
    success: true,
    data: agents.map((agent) => ({
      id: agent.id,
      type: agent.type,
      entityId: agent.entityId,
      name: agent.name,
      lastUpdated: agent.lastUpdated,
      confidence: agent.confidence,
    })),
    total: agents.length,
    warning: init.warning,
  });
}
