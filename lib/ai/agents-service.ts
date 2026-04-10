import {
  getAllAgents,
  getPlayerAgent,
  getTeamAgent,
  initializeAgents,
  refreshAgent,
  type NBAAgent,
} from '@/lib/ai/agents';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

let initialized = false;
let lastWarning: string | undefined;

export async function ensureAgentsInitialized(): Promise<{ warning?: string }> {
  if (initialized) return { warning: lastWarning };

  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const [playersResult, teamsResult] = await Promise.all([
    orchestrator.getPlayers(season),
    orchestrator.getTeams(season),
  ]);

  if (playersResult.data.length === 0 || teamsResult.data.length === 0) {
    lastWarning = playersResult.warning || teamsResult.warning || 'Unable to initialize agents from provider';
    initialized = false;
    return { warning: lastWarning };
  }

  initializeAgents(playersResult.data, teamsResult.data);
  initialized = true;
  lastWarning = playersResult.warning || teamsResult.warning;
  return { warning: lastWarning };
}

export function listAgents(): NBAAgent[] {
  return getAllAgents();
}

export function findAgentById(id: string): NBAAgent | undefined {
  return getAllAgents().find((a) => a.id === id);
}

export function findTeamAgent(teamId: string): NBAAgent | undefined {
  return getTeamAgent(teamId);
}

export function findPlayerAgent(playerId: string): NBAAgent | undefined {
  return getPlayerAgent(playerId);
}

export function triggerRefresh(id: string, type: 'team' | 'player') {
  return refreshAgent(id, type);
}
