import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { answerChat, type ChatContextType, detectIntent } from '@/lib/ai/chat';

type ChatRequest = {
  message: string;
  contextType?: ChatContextType;
  contextId?: string;
};

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    body = { message: '' };
  }

  const message = String(body.message || '').trim();
  const contextType: ChatContextType = body.contextType || 'global';
  const contextId = body.contextId ? String(body.contextId) : undefined;
  const intent = detectIntent(message);

  if (!message) {
    return NextResponse.json({
      success: true,
      data: {
        answer: 'Envie uma pergunta para eu analisar probabilidades, tendências e contexto.',
        confidence: 40,
        sources: [],
        suggestedQuestions: [
          'Qual jogador está em melhor tendência hoje?',
          'Qual time chega em melhor momento?',
          'Quais são os principais riscos do contexto atual?',
        ],
        intent: 'general',
      },
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'Empty message',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }

  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const [playersResult, teamsResult] = await Promise.all([
    orchestrator.getPlayers(season),
    orchestrator.getTeams(season),
  ]);

  const player = contextType === 'player' && contextId
    ? playersResult.data.find((p) => p.id === contextId) || null
    : null;
  const team = contextType === 'team' && contextId
    ? teamsResult.data.find((t) => t.id === contextId) || null
    : null;

  const data = await answerChat({
    message,
    contextType,
    player,
    team,
    players: playersResult.data,
    teams: teamsResult.data,
  });

  console.info(`[AI_CHAT_INTENT_RESOLVED] intent=${intent} context=${contextType}:${contextId || 'none'}`);

  return NextResponse.json({
    success: true,
    data,
    source: playersResult.source !== 'none' ? playersResult.source : teamsResult.source,
    sourceHealth: (playersResult.sourceHealth === 'ok' || teamsResult.sourceHealth === 'ok') ? 'ok' : 'degraded',
    cacheStatus: playersResult.cacheStatus !== 'rejected' ? playersResult.cacheStatus : teamsResult.cacheStatus,
    warning: playersResult.warning || teamsResult.warning,
    errorCode: playersResult.errorCode || teamsResult.errorCode,
  });
}

