import type { Player, TeamWithStats } from '@/lib/types';
import { analyzeTrend } from '@/lib/ai-experts';
import { getRecentSpecialistLearnings, type SpecialistEntityType } from '@/lib/ai/learning-store';

type ChatIntent = 'probability' | 'trend' | 'comparison' | 'injury' | 'betting' | 'general';

export type ChatContextType = 'player' | 'team' | 'global';

export type ChatAnswer = {
  answer: string;
  confidence: number;
  sources: string[];
  suggestedQuestions: string[];
  intent: ChatIntent;
};

export function detectIntent(message: string): ChatIntent {
  const text = message.toLowerCase();
  if (/(chance|probabilidade|over|under|linha|percent)/i.test(text)) return 'probability';
  if (/(tend[eê]ncia|trend|subindo|caindo|momento)/i.test(text)) return 'trend';
  if (/(compar|melhor que|versus|vs)/i.test(text)) return 'comparison';
  if (/(les[aã]o|injury|status|fora|questionable)/i.test(text)) return 'injury';
  if (/(apost|bet|odd|stake|entrada)/i.test(text)) return 'betting';
  return 'general';
}

function guardrailPrefix(intent: ChatIntent): string {
  if (intent !== 'betting') return '';
  return 'Aviso: isso não é recomendação financeira de aposta. ';
}

function formatTopPlayers(players: Player[]): string {
  return players
    .slice()
    .sort((a, b) => (b.projection?.projectedPoints || 0) - (a.projection?.projectedPoints || 0))
    .slice(0, 3)
    .map((p) => `${p.name} (${p.team.abbreviation}) ${p.projection.projectedPoints.toFixed(1)} pts`)
    .join(' | ');
}

async function contextualLearnings(entityType: SpecialistEntityType, entityId: string): Promise<string> {
  const learnings = await getRecentSpecialistLearnings(entityType, entityId, 3);
  if (!learnings.length) return 'Sem aprendizados persistidos recentes.';
  return learnings
    .map((l) => {
      const summary = String(l.learning?.explainability?.summary || '');
      return `${new Date(l.capturedAt).toLocaleString('pt-BR')}: ${summary || 'snapshot salvo'}`;
    })
    .join(' | ');
}

export async function answerChat(input: {
  message: string;
  contextType: ChatContextType;
  player?: Player | null;
  team?: TeamWithStats | null;
  players?: Player[];
  teams?: TeamWithStats[];
}): Promise<ChatAnswer> {
  const intent = detectIntent(input.message);
  const prefix = guardrailPrefix(intent);
  const sources: string[] = [];
  const suggestions = [
    'Qual o principal risco dessa projeção?',
    'Como está a tendência dos últimos jogos?',
    'Qual comparação faz mais sentido hoje?',
  ];

  if (input.contextType === 'player' && input.player) {
    const p = input.player;
    const trend = analyzeTrend(p, 'points');
    const learning = await contextualLearnings('player', p.id);
    sources.push('player.projection', 'player.seasonStats', 'specialist.recentLearnings');

    if (intent === 'injury') {
      const injury = p.injury ? `${p.injury.status} - ${p.injury.description}` : 'Sem alerta de lesão atual';
      return {
        intent,
        confidence: p.projection.confidence,
        sources,
        suggestedQuestions: suggestions,
        answer: `${prefix}${p.name}: ${injury}. Projeção atual de ${p.projection.projectedPoints.toFixed(1)} pontos com confiança ${p.projection.confidence}%.`,
      };
    }

    if (intent === 'trend' || intent === 'probability') {
      return {
        intent,
        confidence: p.projection.confidence,
        sources,
        suggestedQuestions: suggestions,
        answer: `${prefix}${p.name} está em tendência ${trend.direction} (${trend.magnitude}%). Projeção: ${p.projection.projectedPoints.toFixed(1)} pts, ${p.projection.projectedAssists.toFixed(1)} ast, ${p.projection.projectedRebounds.toFixed(1)} reb. Aprendizado recente: ${learning}`,
      };
    }

    return {
      intent,
      confidence: p.projection.confidence,
      sources,
      suggestedQuestions: suggestions,
      answer: `${prefix}Resumo de ${p.name}: ${p.seasonStats.points.toFixed(1)} PPG na temporada, tendência ${trend.direction}, confiança ${p.projection.confidence}% e aprendizado recente: ${learning}`,
    };
  }

  if (input.contextType === 'team' && input.team) {
    const t = input.team;
    const learning = await contextualLearnings('team', t.id);
    sources.push('team.stats', 'team.lastGames', 'specialist.recentLearnings');
    const wins = t.lastGames.filter((x) => x === 'W').length;
    const trend = wins >= 3 ? 'alta' : wins <= 1 ? 'baixa' : 'estável';

    return {
      intent,
      confidence: 72,
      sources,
      suggestedQuestions: suggestions,
      answer: `${prefix}${t.city} ${t.name}: record ${t.stats.wins}-${t.stats.losses}, OFF ${t.stats.offensiveRating.toFixed(1)}, DEF ${t.stats.defensiveRating.toFixed(1)}, tendência recente ${trend}. Aprendizado recente: ${learning}`,
    };
  }

  const players = input.players || [];
  const teams = input.teams || [];
  const topPlayers = players.length ? formatTopPlayers(players) : 'Sem dados de jogadores';
  const topTeams = teams
    .slice()
    .sort((a, b) => (b.stats.wins - a.stats.wins))
    .slice(0, 3)
    .map((t) => `${t.abbreviation} ${t.stats.wins}-${t.stats.losses}`)
    .join(' | ');

  sources.push('players.list', 'teams.list');
  return {
    intent,
    confidence: 68,
    sources,
    suggestedQuestions: suggestions,
    answer: `${prefix}Contexto global: destaques de jogadores -> ${topPlayers}. Times em melhor momento -> ${topTeams || 'Sem dados de times'}.`,
  };
}

