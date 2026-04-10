import { NextResponse } from 'next/server';
import { ensureAgentsInitialized, findAgentById } from '@/lib/ai/agents-service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const init = await ensureAgentsInitialized();
  const agent = findAgentById(id);

  return NextResponse.json({
    success: true,
    data: agent || null,
    warning: agent ? init.warning : (init.warning || 'Agent not found'),
  });
}

