export interface YouTubeSubscriptionStatus {
  subscribed: boolean;
  source: 'oauth';
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface YouTubeSubscriptionListResponse {
  items?: Array<{ id?: string }>;
  error?: { message?: string };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function fetchAccessToken(): Promise<string | undefined> {
  const clientId = readEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = readEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = readEnv('GOOGLE_OAUTH_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    return undefined;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error ?? `Google OAuth token exchange failed (${response.status}).`);
  }

  return json.access_token;
}

/**
 * Returns whether the configured Google account subscribes to `channelId`.
 *
 * Requires `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`
 * with the `https://www.googleapis.com/auth/youtube.readonly` scope.
 */
export async function checkYouTubeSubscription(
  channelId: string,
): Promise<YouTubeSubscriptionStatus | undefined> {
  if (!channelId.startsWith('UC')) {
    return undefined;
  }

  const accessToken = await fetchAccessToken();
  if (!accessToken) {
    return undefined;
  }

  const apiKey = readEnv('YOUTUBE_API_KEY');
  const query = new URLSearchParams({
    part: 'id',
    mine: 'true',
    forChannelId: channelId,
    maxResults: '1',
  });
  if (apiKey) {
    query.set('key', apiKey);
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await response.json()) as YouTubeSubscriptionListResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `YouTube subscriptions lookup failed (${response.status}).`);
  }

  return {
    subscribed: (json.items?.length ?? 0) > 0,
    source: 'oauth',
  };
}
