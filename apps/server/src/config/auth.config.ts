export const APP_SESSION_COOKIE_NAME = 'llaab_session';
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getApiKey(): string | null {
  return process.env['LLAAB_API_KEY'] ?? null;
}

export function getAppPassword(): string | null {
  const password = process.env['LLAAB_PASSWORD'];
  return password ? password : null;
}

export function getCookieSecret(): string {
  return process.env['LLAAB_COOKIE_SECRET'] ?? 'dev-secret-change-me';
}

export function isAppAuthEnabled(): boolean {
  return getApiKey() !== null || getAppPassword() !== null;
}
