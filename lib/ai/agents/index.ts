import type { Player, Team } from '@/lib/types';

export interface NBAAgent {
  id: string;
  type: 'team' | 'player';
  entityId: string;
  name: string;
  personality?: AgentPersonality;
  knowledge: KnowledgeBase;
  analysis: AgentAnalysis;
  projections: AgentProjections;
  lastUpdated: Date;
  confidence: number;
}

interface AgentPersonality {
  style: string;
  expertise: string[];
  focus: string[];
  descriptors: string[];
}

interface KnowledgeBase {
  stats: Record<string, number>;
  recentGames: any[];
  trends: Record<string, string>;
  injuries: any[];
}

interface AgentAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface AgentProjections {
  points: { projected: number; confidence: number };
  assists: { projected: number; confidence: number };
  rebounds: { projected: number; confidence: number };
}

const teamAgents: Map<string, NBAAgent> = new Map();
const playerAgents: Map<string, NBAAgent> = new Map();

function generateTeamAgent(team: Team): NBAAgent {
  return {
    id: `agent-${team.id}`,
    type: 'team',
    entityId: team.id,
    name: `${team.city} ${team.name} Expert Agent`,
    personality: {
      style: 'balanced',
      expertise: ['offense', 'defense'],
      focus: ['win rate', 'efficiency'],
      descriptors: ['competitive', 'strategic'],
    },
    knowledge: {
      stats: {},
      recentGames: [],
      trends: { offense: 'stable', defense: 'stable' },
      injuries: [],
    },
    analysis: {
      strengths: ['Strong roster', 'Experienced coaching'],
      weaknesses: ['Injury concerns', 'Depth issues'],
      opportunities: ['Playoff push', 'Rival weaknesses'],
      threats: ['Tough schedule', 'Fatigue'],
    },
    projections: {
      points: { projected: 0, confidence: 0 },
      assists: { projected: 0, confidence: 0 },
      rebounds: { projected: 0, confidence: 0 },
    },
    lastUpdated: new Date(),
    confidence: 75,
  };
}

function generatePlayerAgent(player: Player): NBAAgent {
  const stats = player.seasonStats;
  const proj = player.projection;

  return {
    id: `agent-player-${player.id}`,
    type: 'player',
    entityId: player.id,
    name: `${player.name} Analyst`,
    personality: {
      style: getPlayerStyle(player),
      expertise: getExpertise(player),
      focus: getFocus(player),
      descriptors: getDescriptors(player),
    },
    knowledge: {
      stats: {
        points: stats.points,
        assists: stats.assists,
        rebounds: stats.rebounds,
        fgPct: stats.fieldGoalPercentage,
      },
      recentGames: [],
      trends: {
        points: proj.trend,
        efficiency: 'stable',
      },
      injuries: player.injury ? [player.injury] : [],
    },
    analysis: getAnalysis(player),
    projections: {
      points: { projected: proj.projectedPoints, confidence: proj.confidence },
      assists: { projected: proj.projectedAssists, confidence: Math.max(50, proj.confidence - 10) },
      rebounds: { projected: proj.projectedRebounds, confidence: Math.max(50, proj.confidence - 15) },
    },
    lastUpdated: new Date(),
    confidence: proj.confidence,
  };
}

function getPlayerStyle(player: Player): string {
  const stats = player.seasonStats;
  if (stats.points > 25) return 'scorer';
  if (stats.assists > 8) return 'playmaker';
  if (stats.rebounds > 10) return 'rebounders';
  if (stats.steals + stats.blocks > 2) return 'defender';
  return 'versatile';
}

function getExpertise(player: Player): string[] {
  const expertise: string[] = [];
  const stats = player.seasonStats;
  
  if (stats.threePointPercentage > 38) expertise.push('three-point shooting');
  if (stats.fieldGoalPercentage > 52) expertise.push('efficiency');
  if (stats.assists > 6) expertise.push('playmaking');
  if (stats.rebounds > 8) expertise.push('rebounding');
  if (stats.points > 20) expertise.push('scoring');
  
  return expertise.length > 0 ? expertise : ['general analysis'];
}

function getFocus(player: Player): string[] {
  const focus: string[] = [];
  
  if (player.injury) focus.push('injury monitoring');
  focus.push('matchup analysis');
  focus.push('trend tracking');
  
  return focus;
}

function getDescriptors(player: Player): string[] {
  const descriptors: string[] = [];
  const stats = player.seasonStats;
  
  if (stats.points > 25) descriptors.push('elite scorer');
  if (stats.assists > 7) descriptors.push('elite playmaker');
  if (stats.fieldGoalPercentage > 50) descriptors.push('efficient');
  if (player.experience > 10) descriptors.push('veteran');
  else if (player.experience < 3) descriptors.push('young');
  
  return descriptors.length > 0 ? descriptors : ['consistent performer'];
}

function getAnalysis(player: Player): AgentAnalysis {
  const stats = player.seasonStats;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];

  if (stats.points > 20) {
    strengths.push(`Elite scorer with ${stats.points.toFixed(1)} PPG`);
  } else if (stats.points > 15) {
    strengths.push(`Solid contributor with ${stats.points.toFixed(1)} PPG`);
  }

  if (stats.fieldGoalPercentage > 50) {
    strengths.push(`High efficiency (${stats.fieldGoalPercentage.toFixed(1)}% FG)`);
  } else if (stats.fieldGoalPercentage < 42) {
    weaknesses.push(`Below average efficiency (${stats.fieldGoalPercentage.toFixed(1)}% FG)`);
  }

  if (stats.threePointPercentage > 38) {
    strengths.push(`Excellent 3PT shooter (${stats.threePointPercentage.toFixed(1)}%)`);
  }

  if (stats.assists > 6) {
    strengths.push(`Good playmaker (${stats.assists.toFixed(1)} APG)`);
  }

  if (stats.turnovers > 3.5) {
    weaknesses.push(`High turnover rate (${stats.turnovers.toFixed(1)} TPG)`);
  }

  if (player.projection.trend === 'up') {
    opportunities.push('Positive trend in recent games');
  }

  if (player.injury) {
    threats.push(`Injury: ${player.injury.status} - ${player.injury.description}`);
  }

  if (player.projection.confidence < 60) {
    threats.push('Low projection confidence');
  }

  return { strengths, weaknesses, opportunities, threats };
}

export function initializeAgents(playersList: Player[], teamsList: Team[]) {
  teamsList.forEach(team => {
    const agent = generateTeamAgent(team);
    teamAgents.set(team.id, agent);
  });

  playersList.forEach(player => {
    const agent = generatePlayerAgent(player);
    playerAgents.set(player.id, agent);
  });
}

export function getTeamAgent(teamId: string): NBAAgent | undefined {
  return teamAgents.get(teamId);
}

export function getPlayerAgent(playerId: string): NBAAgent | undefined {
  return playerAgents.get(playerId);
}

export function refreshAgent(entityId: string, type: 'team' | 'player'): NBAAgent {
  if (type === 'team') {
    const agent = teamAgents.get(entityId);
    if (agent) {
      agent.lastUpdated = new Date();
      return agent;
    }
  } else {
    const agent = playerAgents.get(entityId);
    if (agent) {
      agent.lastUpdated = new Date();
      return agent;
    }
  }
  
  throw new Error(`Agent not found for ${type}: ${entityId}`);
}

export function getAllAgents(): NBAAgent[] {
  return [...Array.from(teamAgents.values()), ...Array.from(playerAgents.values())];
}
