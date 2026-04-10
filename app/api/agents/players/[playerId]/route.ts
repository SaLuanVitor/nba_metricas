import { NextResponse } from 'next/server';
import { ensureAgentsInitialized, findPlayerAgent } from '@/lib/ai/agents-service';

type Params = { params: Promise<{ playerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { playerId } = await params;
  const init = await ensureAgentsInitialized();
  const agent = findPlayerAgent(playerId);

  return NextResponse.json({
    success: true,
    data: agent || null,
    warning: agent ? init.warning : (init.warning || 'Player agent not found'),
  });
}

