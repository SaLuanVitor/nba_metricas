type TeamLike = {
  id?: string | number | null;
  abbreviation?: string | null;
};

const TEAM_ID_BY_ABBR: Record<string, string> = {
  ATL: '1610612737',
  BOS: '1610612738',
  BKN: '1610612751',
  CHA: '1610612766',
  CHI: '1610612741',
  CLE: '1610612739',
  DAL: '1610612742',
  DEN: '1610612743',
  DET: '1610612765',
  GSW: '1610612744',
  HOU: '1610612745',
  IND: '1610612754',
  LAC: '1610612746',
  LAL: '1610612747',
  MEM: '1610612763',
  MIA: '1610612748',
  MIL: '1610612749',
  MIN: '1610612750',
  NOP: '1610612740',
  NYK: '1610612752',
  OKC: '1610612760',
  ORL: '1610612753',
  PHI: '1610612755',
  PHX: '1610612756',
  POR: '1610612757',
  SAC: '1610612758',
  SAS: '1610612759',
  TOR: '1610612761',
  UTA: '1610612762',
  WAS: '1610612764',
};

const TEAM_ABBR_BY_ID: Record<string, string> = Object.entries(TEAM_ID_BY_ABBR).reduce<Record<string, string>>(
  (acc, [abbr, id]) => {
    acc[id] = abbr;
    return acc;
  },
  {}
);

const TEAM_LOGO_BASE_URL = 'https://a.espncdn.com/i/teamlogos/nba/500';
const PLAYER_HEADSHOT_BASE_URL = 'https://cdn.nba.com/headshots/nba/latest/1040x760';

export const TEAM_LOGO_FALLBACK = '/team-default.svg';
export const PLAYER_IMAGE_FALLBACK = '/player-default.jpg';

function resolveTeamAbbreviation(team?: TeamLike): string | null {
  const rawAbbr = String(team?.abbreviation || '').trim().toUpperCase();
  if (rawAbbr && TEAM_ID_BY_ABBR[rawAbbr]) return rawAbbr;
  const rawId = String(team?.id || '').trim();
  if (/^\d+$/.test(rawId) && TEAM_ABBR_BY_ID[rawId]) return TEAM_ABBR_BY_ID[rawId];
  const abbr = String(team?.abbreviation || '').trim().toUpperCase();
  return abbr || null;
}

export function teamLogoUrl(team?: TeamLike): string {
  const abbreviation = resolveTeamAbbreviation(team);
  if (!abbreviation) return TEAM_LOGO_FALLBACK;
  return `${TEAM_LOGO_BASE_URL}/${abbreviation.toLowerCase()}.png`;
}

export function playerHeadshotUrl(playerId?: string | number | null): string {
  const normalized = String(playerId || '').trim();
  if (!/^\d+$/.test(normalized)) return PLAYER_IMAGE_FALLBACK;
  return `${PLAYER_HEADSHOT_BASE_URL}/${normalized}.png`;
}

export function withPlayerHeadshotFallback(imageUrl: string | undefined | null, playerId?: string | number | null): string {
  const current = String(imageUrl || '').trim();
  if (current) return current;
  return playerHeadshotUrl(playerId);
}
