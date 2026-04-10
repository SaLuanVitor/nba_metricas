import { NextResponse } from 'next/server';
import { ensureAgentsInitialized, findAgentById, triggerRefresh } from '@/lib/ai/agents-service';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const init = await ensureAgentsInitialized();
  const agent = findAgentById(id);

  if (!agent) {
    return NextResponse.json({
      success: true,
      data: null,
      warning: init.warning || 'Agent not found',
    });
  }

  const refreshed = triggerRefresh(agent.entityId, agent.type);

  return NextResponse.json({
    success: true,
    data: refreshed,
    message: 'Agent refreshed successfully',
    warning: init.warning,
    updatedAt: new Date().toISOString(),
  });
}

