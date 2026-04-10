import type { TeamWithStats } from '@/lib/types';

type DebateWinner = 'home' | 'away' | 'draw';
type DebateRoundKey =
  | 'record_winpct'
  | 'offensive_rating'
  | 'defensive_rating'
  | 'pace'
  | 'recent_form'
  | 'player_matchups';

export type DebateRound = {
  id: DebateRoundKey;
  title: string;
  homeClaim: string;
  awayChallenge: string;
  awayClaim: string;
  homeChallenge: string;
  verification: string;
  winner: DebateWinner;
};

export type DebateVerdict = {
  label: 'CONFIAVEL' | 'NAO CONFIAVEL';
  trustScore: number;
  winner: DebateWinner;
  summary: string;
  reasons: string[];
};

type Input = {
  homeTeam: TeamWithStats;
  awayTeam: TeamWithStats;
  homeTeamConfidence: number;
  awayTeamConfidence: number;
  homeRosterCount: number;
  awayRosterCount: number;
  sourceHealth: 'ok' | 'degraded';
  warning?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWinPct(team: TeamWithStats): number {
  const games = Math.max(1, team.stats.wins + team.stats.losses);
  return team.stats.wins / games;
}

function getRecentWins(team: TeamWithStats): number {
  return team.lastGames.filter((x) => x === 'W').length;
}

function winnerByHigher(home: number, away: number, tolerance = 0.25): DebateWinner {
  if (Math.abs(home - away) <= tolerance) return 'draw';
  return home > away ? 'home' : 'away';
}

function winnerByLower(home: number, away: number, tolerance = 0.25): DebateWinner {
  if (Math.abs(home - away) <= tolerance) return 'draw';
  return home < away ? 'home' : 'away';
}

function scoreByWinner(rounds: DebateRound[]): { home: number; away: number } {
  return rounds.reduce(
    (acc, round) => {
      if (round.winner === 'home') acc.home += 1;
      if (round.winner === 'away') acc.away += 1;
      return acc;
    },
    { home: 0, away: 0 }
  );
}

function calculateTrustScore(input: Input): number {
  const avgConfidence = (input.homeTeamConfidence + input.awayTeamConfidence) / 2;
  const rosterCoverage = clamp((input.homeRosterCount + input.awayRosterCount) / 24, 0, 1);
  const statsSignals = [
    input.homeTeam.stats.wins + input.homeTeam.stats.losses,
    input.awayTeam.stats.wins + input.awayTeam.stats.losses,
    input.homeTeam.stats.offensiveRating,
    input.awayTeam.stats.offensiveRating,
    input.homeTeam.stats.defensiveRating,
    input.awayTeam.stats.defensiveRating,
    input.homeTeam.stats.pace,
    input.awayTeam.stats.pace,
  ];
  const availableSignals = statsSignals.filter((value) => Number.isFinite(value) && value > 0).length;
  const statsCoverage = availableSignals / statsSignals.length;

  let score = 40;
  score += avgConfidence * 0.28;
  score += rosterCoverage * 18;
  score += statsCoverage * 20;
  score += input.sourceHealth === 'ok' ? 8 : -8;
  if (input.warning) score -= 8;
  return clamp(Math.round(score), 0, 100);
}

function formatRoundWinner(winner: DebateWinner): string {
  if (winner === 'home') return 'Vantagem mandante';
  if (winner === 'away') return 'Vantagem visitante';
  return 'Empate tecnico';
}

export function buildPredictionDebate(input: Input): { rounds: DebateRound[]; verdict: DebateVerdict } {
  const homeWinPct = getWinPct(input.homeTeam);
  const awayWinPct = getWinPct(input.awayTeam);
  const homeRecentWins = getRecentWins(input.homeTeam);
  const awayRecentWins = getRecentWins(input.awayTeam);

  const rounds: DebateRound[] = [
    {
      id: 'record_winpct',
      title: 'Record e Win%',
      homeClaim: `${input.homeTeam.abbreviation} defende que ${(homeWinPct * 100).toFixed(1)}% de vitorias valida favoritismo.`,
      awayChallenge: `${input.awayTeam.abbreviation} questiona o contexto do calendario e exige prova em eficiencia.`,
      awayClaim: `${input.awayTeam.abbreviation} aponta ${(awayWinPct * 100).toFixed(1)}% de Win% como base para equilibrar o confronto.`,
      homeChallenge: `${input.homeTeam.abbreviation} rebate com diferenca de campanha total (${input.homeTeam.stats.wins}-${input.homeTeam.stats.losses} vs ${input.awayTeam.stats.wins}-${input.awayTeam.stats.losses}).`,
      verification: `${formatRoundWinner(winnerByHigher(homeWinPct, awayWinPct, 0.01))} pela metrica de Win%.`,
      winner: winnerByHigher(homeWinPct, awayWinPct, 0.01),
    },
    {
      id: 'offensive_rating',
      title: 'Ataque (OFF Rating)',
      homeClaim: `${input.homeTeam.abbreviation} afirma que OFF ${input.homeTeam.stats.offensiveRating.toFixed(1)} gera teto maior de pontuacao.`,
      awayChallenge: `${input.awayTeam.abbreviation} responde que volume sem eficiencia nao sustenta vantagem.`,
      awayClaim: `${input.awayTeam.abbreviation} traz OFF ${input.awayTeam.stats.offensiveRating.toFixed(1)} para contestar a narrativa.`,
      homeChallenge: `${input.homeTeam.abbreviation} rebate apontando diferencial direto de ataque.`,
      verification: `${formatRoundWinner(winnerByHigher(input.homeTeam.stats.offensiveRating, input.awayTeam.stats.offensiveRating))} no OFF Rating.`,
      winner: winnerByHigher(input.homeTeam.stats.offensiveRating, input.awayTeam.stats.offensiveRating),
    },
    {
      id: 'defensive_rating',
      title: 'Defesa (DEF Rating)',
      homeClaim: `${input.homeTeam.abbreviation} diz que DEF ${input.homeTeam.stats.defensiveRating.toFixed(1)} reduz consistencia ofensiva rival.`,
      awayChallenge: `${input.awayTeam.abbreviation} duvida da sustentacao contra ataques de alto pace.`,
      awayClaim: `${input.awayTeam.abbreviation} aponta DEF ${input.awayTeam.stats.defensiveRating.toFixed(1)} para validar sua protecao de aro/perimetro.`,
      homeChallenge: `${input.homeTeam.abbreviation} cobra comparacao objetiva de eficiencia defensiva.`,
      verification: `${formatRoundWinner(winnerByLower(input.homeTeam.stats.defensiveRating, input.awayTeam.stats.defensiveRating))} no DEF Rating (menor e melhor).`,
      winner: winnerByLower(input.homeTeam.stats.defensiveRating, input.awayTeam.stats.defensiveRating),
    },
    {
      id: 'pace',
      title: 'Ritmo (PACE)',
      homeClaim: `${input.homeTeam.abbreviation} argumenta que pace ${input.homeTeam.stats.pace.toFixed(1)} favorece seu plano de jogo.`,
      awayChallenge: `${input.awayTeam.abbreviation} questiona se o ritmo realmente converte em eficiencia liquida.`,
      awayClaim: `${input.awayTeam.abbreviation} defende pace ${input.awayTeam.stats.pace.toFixed(1)} como vantagem de transicao.`,
      homeChallenge: `${input.homeTeam.abbreviation} rebate que ritmo sem controle de perdas amplia variancia.`,
      verification: `${formatRoundWinner(winnerByHigher(input.homeTeam.stats.pace, input.awayTeam.stats.pace, 0.3))} no PACE.`,
      winner: winnerByHigher(input.homeTeam.stats.pace, input.awayTeam.stats.pace, 0.3),
    },
    {
      id: 'recent_form',
      title: 'Forma recente (ultimos 10)',
      homeClaim: `${input.homeTeam.abbreviation} destaca ${homeRecentWins}-${
        Math.max(0, input.homeTeam.lastGames.length - homeRecentWins)
      } recente como prova de consistencia.`,
      awayChallenge: `${input.awayTeam.abbreviation} contesta dizendo que amostra curta precisa de confirmacao por matchup.`,
      awayClaim: `${input.awayTeam.abbreviation} responde com ${awayRecentWins} vitorias recentes e tendencia competitiva.`,
      homeChallenge: `${input.homeTeam.abbreviation} exige confirmacao por confronto direto de estilos.`,
      verification: `${formatRoundWinner(winnerByHigher(homeRecentWins, awayRecentWins, 0))} na forma recente.`,
      winner: winnerByHigher(homeRecentWins, awayRecentWins, 0),
    },
    {
      id: 'player_matchups',
      title: 'Matchups de elenco',
      homeClaim: `${input.homeTeam.abbreviation} argumenta que profundidade (${input.homeRosterCount} jogadores mapeados) reduz risco de colapso.`,
      awayChallenge: `${input.awayTeam.abbreviation} rebate com rotacao alternativa e adaptacao tatico-defensiva.`,
      awayClaim: `${input.awayTeam.abbreviation} aponta ${input.awayRosterCount} jogadores analisados para sustentar paridade.`,
      homeChallenge: `${input.homeTeam.abbreviation} contesta variabilidade com base na cobertura real de atletas ativos.`,
      verification: `${formatRoundWinner(winnerByHigher(input.homeRosterCount, input.awayRosterCount, 1))} na cobertura de matchups.`,
      winner: winnerByHigher(input.homeRosterCount, input.awayRosterCount, 1),
    },
  ];

  const score = scoreByWinner(rounds);
  const trustScore = calculateTrustScore(input);
  const rosterCoverageOk = input.homeRosterCount >= 8 && input.awayRosterCount >= 8;
  const label: DebateVerdict['label'] = trustScore >= 70 && rosterCoverageOk ? 'CONFIAVEL' : 'NAO CONFIAVEL';
  const winner: DebateWinner = score.home === score.away ? 'draw' : score.home > score.away ? 'home' : 'away';

  const reasons: string[] = [
    `Rodadas vencidas: casa ${score.home} x visitante ${score.away}`,
    `Cobertura de elenco: casa ${input.homeRosterCount}, visitante ${input.awayRosterCount}`,
    input.sourceHealth === 'ok' ? 'Fonte de dados em estado ok' : 'Fonte de dados em estado degradado',
  ];
  if (input.warning) reasons.push(`Aviso operacional: ${input.warning}`);

  const summary =
    winner === 'draw'
      ? 'Embate equilibrado; usar stake conservadora e monitorar updates de ultima hora.'
      : winner === 'home'
        ? `${input.homeTeam.abbreviation} venceu o embate tecnico por evidencias agregadas.`
        : `${input.awayTeam.abbreviation} venceu o embate tecnico por evidencias agregadas.`;

  return {
    rounds,
    verdict: {
      label,
      trustScore,
      winner,
      summary,
      reasons,
    },
  };
}
