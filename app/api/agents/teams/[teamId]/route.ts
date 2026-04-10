import { NextResponse } from 'next/server';
import { ensureAgentsInitialized, findTeamAgent } from '@/lib/ai/agents-service';

type Params = { params: Promise<{ teamId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { teamId } = await params;
  const init = await ensureAgentsInitialized();
  const agent = findTeamAgent(teamId);

  return NextResponse.json({
    success: true,
    data: agent || null,
    warning: agent ? init.warning : (init.warning || 'Team agent not found'),
  });
}

