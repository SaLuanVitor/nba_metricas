import { NextResponse } from 'next/server';
import { getMatchupPrediction } from '@/lib/ai/predictions-service';

type Intent = 'probability' | 'trend' | 'comparison' | 'risk' | 'general';

function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  if (/(chance|probabilidade|percent|win|vencer|odds)/i.test(text)) return 'probability';
  if (/(tendencia|momento|forma|sequencia|streak)/i.test(text)) return 'trend';
  if (/(compar|vs|versus|melhor|pior)/i.test(text)) return 'comparison';
  if (/(risco|lesao|injury|duvida|incerto|incerteza)/i.test(text)) return 'risk';
  return 'general';
}

function includesBettingWords(message: string): boolean {
  return /(apost|bet|stake|entrada|odd)/i.test(message);
}

export async function POST(request: Request) {
  let body: { message?: string; gameId?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const message = String(body.message || '').trim();
  const gameId = String(body.gameId || '').trim();
  const intent = detectIntent(message);

  if (!gameId) {
    return NextResponse.json({
      success: true,
      data: {
        answer: 'Informe um gameId valido para analisar o confronto.',
        confidence: 30,
        sources: [],
        suggestedQuestions: [
          'Qual time chega mais forte agora?',
          'Onde estao os principais riscos do confronto?',
          'Qual lado venceu mais rodadas no embate?',
        ],
        intent,
      },
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'gameId is required',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }

  if (!message) {
    return NextResponse.json({
      success: true,
      data: {
        answer: 'Envie uma pergunta sobre o confronto atual ou futuro selecionado.',
        confidence: 30,
        sources: [],
        suggestedQuestions: [
          'Qual o veredito de confiabilidade deste jogo?',
          'Quais fatores decidiram o embate?',
          'Quais jogadores mudam mais o resultado?',
        ],
        intent,
      },
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'message is required',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }

  const matchup = await getMatchupPrediction(gameId, { persistLearners: false });
  const data = matchup.data;

  if (!data) {
    return NextResponse.json({
      success: true,
      data: {
        answer: 'Nao encontrei esse jogo entre os eventos ao vivo ou programados. O chat de predicoes so analisa jogos de agora ou futuros.',
        confidence: 25,
        sources: ['games.today'],
        suggestedQuestions: [
          'Quais jogos estao ao vivo agora?',
          'Qual confronto programado tem melhor confiabilidade?',
          'Mostre os riscos do proximo jogo relevante.',
        ],
        intent,
      },
      source: matchup.source,
      sourceHealth: matchup.sourceHealth,
      cacheStatus: matchup.cacheStatus,
      warning: matchup.warning,
      errorCode: matchup.errorCode,
    });
  }

  const gameStatus = String(data.game?.status || '').toLowerCase();
  if (gameStatus === 'final') {
    return NextResponse.json({
      success: true,
      data: {
        answer: 'Este jogo ja terminou. O chat de predicoes responde apenas jogos ao vivo ou programados.',
        confidence: 20,
        sources: ['game.status'],
        suggestedQuestions: [
          'Analise o proximo jogo programado deste time.',
          'Quais embates atuais estao mais confiaveis?',
          'Compare dois jogos que vao acontecer hoje.',
        ],
        intent,
      },
      source: matchup.source,
      sourceHealth: matchup.sourceHealth,
      cacheStatus: matchup.cacheStatus,
      warning: 'Final games are blocked in predictions chat',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
    });
  }

  const verdict = data.finalVerdict;
  const topRounds = (data.debateRounds || []).slice(0, 3).map((round: any) => `${round.title}: ${round.verification}`);
  const home = data.game?.homeTeam?.abbreviation || 'HOME';
  const away = data.game?.awayTeam?.abbreviation || 'AWAY';
  const bettingPrefix = includesBettingWords(message)
    ? 'Aviso: esta resposta nao e conselho financeiro de aposta. '
    : '';

  let answer = '';

  if (intent === 'probability') {
    answer = `${bettingPrefix}Embate ${away} @ ${home}: trust score ${verdict.trustScore}/100, selo ${verdict.label}. Vencedor tecnico atual: ${verdict.winner}. Evidencias: ${topRounds.join(' | ')}.`;
  } else if (intent === 'trend') {
    const homeRecent = data.teamSpecialists?.home?.explainability?.factors?.find((x: string) => x.includes('Record')) || 'Sem fator de record';
    const awayRecent = data.teamSpecialists?.away?.explainability?.factors?.find((x: string) => x.includes('Record')) || 'Sem fator de record';
    answer = `${away} @ ${home}: tendencia atual resumida -> ${home}: ${homeRecent}. ${away}: ${awayRecent}. Veredito: ${verdict.summary}`;
  } else if (intent === 'comparison') {
    const homeWins = (data.debateRounds || []).filter((round: any) => round.winner === 'home').length;
    const awayWins = (data.debateRounds || []).filter((round: any) => round.winner === 'away').length;
    answer = `${away} @ ${home}: no embate direto, casa venceu ${homeWins} rodadas e visitante venceu ${awayWins}. Resultado consolidado: ${verdict.summary} (${verdict.label}).`;
  } else if (intent === 'risk') {
    const warnings = verdict.reasons?.join(' | ') || 'Sem riscos adicionais mapeados';
    answer = `${away} @ ${home}: riscos atuais -> ${warnings}. Se houver mudanca de status de jogador ou line movement, o selo pode mudar rapidamente.`;
  } else {
    answer = `${away} @ ${home}: ${verdict.summary} Trust score ${verdict.trustScore}/100 (${verdict.label}). Rodadas-chave: ${topRounds.join(' | ')}.`;
  }

  console.info(`[PREDICTIONS_CHAT_INTENT_RESOLVED] intent=${intent} gameId=${gameId}`);

  return NextResponse.json({
    success: true,
    data: {
      answer,
      confidence: Math.max(35, Math.min(95, Number(verdict.trustScore || 60))),
      sources: ['predictions.matchup', 'team.specialists', 'player.specialists', 'debate.rounds'],
      suggestedQuestions: [
        'Quais rodadas foram mais decisivas neste embate?',
        'Qual jogador mais altera o cenario se ficar fora?',
        'O selo de confiabilidade pode mudar ate o tipoff?',
      ],
      intent,
    },
    source: matchup.source,
    sourceHealth: matchup.sourceHealth,
    cacheStatus: matchup.cacheStatus,
    warning: matchup.warning,
    errorCode: matchup.errorCode,
  });
}
