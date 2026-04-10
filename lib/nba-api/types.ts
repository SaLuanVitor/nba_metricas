export * from './client';

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  team: Team;
  height: string;
  weight: number;
  age: number;
  experience: number;
  college: string;
  imageUrl: string;
  seasonStats: PlayerStats;
  last5Games: PlayerStats[];
  projection: PlayerProjection;
  fantasyPoints: number;
  salary: number;
  injury?: Injury;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl?: string;
  city: string;
  conference: 'East' | 'West';
  division: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface PlayerStats {
  points: number;
  assists: number;
  rebounds: number;
  minutes: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls?: number;
}

export interface PlayerProjection {
  projectedPoints: number;
  projectedAssists: number;
  projectedRebounds: number;
  projectedMinutes: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Injury {
  status: 'Out' | 'Questionable' | 'Probable' | 'Day-to-Day';
  description: string;
}

export interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  time: string;
  status: 'scheduled' | 'live' | 'final';
  homeScore?: number;
  awayScore?: number;
  venue: string;
}

export interface TrendDirection {
  direction: 'strong-up' | 'up' | 'stable' | 'down' | 'strong-down';
  magnitude: number;
  period: string;
}

export interface ConfidenceLevel {
  level: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  score: number;
}
