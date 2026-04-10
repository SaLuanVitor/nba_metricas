export type TeamConference = 'East' | 'West';

const CONFERENCE_BY_ABBREVIATION: Record<string, TeamConference> = {
  ATL: 'East',
  BOS: 'East',
  BKN: 'East',
  CHA: 'East',
  CHI: 'East',
  CLE: 'East',
  DET: 'East',
  IND: 'East',
  MIA: 'East',
  MIL: 'East',
  NYK: 'East',
  ORL: 'East',
  PHI: 'East',
  TOR: 'East',
  WAS: 'East',
  DAL: 'West',
  DEN: 'West',
  GSW: 'West',
  HOU: 'West',
  LAC: 'West',
  LAL: 'West',
  MEM: 'West',
  MIN: 'West',
  NOP: 'West',
  OKC: 'West',
  PHX: 'West',
  POR: 'West',
  SAC: 'West',
  SAS: 'West',
  UTA: 'West',
};

export function getConferenceByAbbreviation(abbreviation?: string): TeamConference | undefined {
  const key = String(abbreviation || '').trim().toUpperCase();
  if (!key) return undefined;
  return CONFERENCE_BY_ABBREVIATION[key];
}
