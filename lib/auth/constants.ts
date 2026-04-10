export const AUTH_COOKIE_NAME = 'nba_auth_session';
export const GOOGLE_STATE_COOKIE = 'nba_google_state';
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-insecure-auth-secret-change-me';
}
