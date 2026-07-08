# YouTube OAuth — subscription status (`youtube_subscribed`)

📅 Jul 8, 2026

Condensed setup for LLAAB's **YouTube subscription check**. This populates `youtube_subscribed` on
`SourceNode` vault files and drives subscription icons in the Runs table and source detail UI.

**Secrets:** `GOOGLE_OAUTH_*` values live only in repo-root `.env` — never commit tokens.

---

## What it does

| Piece                                                  | Role                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `packages/ingestion/src/fetch/youtube-subscription.ts` | Exchanges refresh token → access token; calls YouTube `subscriptions` API    |
| `packages/ingestion/src/enrich/source-metadata.ts`     | `enrichSourceMetadata()` — writes `youtube_subscribed` to vault              |
| `POST /api/vault/sources/:id/enrich`                   | Server entry; triggered from `/ingest` (background) and `/vault/sources/:id` |

**Ingest does not set `youtube_subscribed`.** The ingest pipeline creates a basic `SourceNode`;
enrich runs afterward (client-side) and is when the subscription field is written.

`follow` on `SourceNode` is a separate, unimplemented LLAAB auto-refresh flag — not YouTube
subscription.

---

## Prerequisites

1. **Google Cloud project** with **YouTube Data API v3** enabled.
2. **OAuth 2.0 Client ID** (type: **Web application**) — note Client ID and Client secret.
3. **Authorized redirect URI** on that client:

   ```
   https://developers.google.com/oauthplayground
   ```

4. **OAuth consent screen:** if the app is in **Testing**, your Google account must be listed as a
   **Test user**.

### `.env` vars (repo root)

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
```

Optional: `YOUTUBE_API_KEY` (public channel metadata; subscription check uses OAuth, not the API
key alone).

---

## Initial setup (OAuth Playground)

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. **Gear icon** → configure:
   - **Use your own OAuth credentials** → **checked**
   - **OAuth Client ID** / **Client secret** → same Web client as in `.env`
   - **Access type** → **Offline** (required for refresh token)
   - **Force prompt** → **Consent Screen** (forces a new refresh token)
3. **Step 1** — select scope:

   ```
   https://www.googleapis.com/auth/youtube.readonly
   ```

4. **Authorize APIs** → sign in with the Google account whose YouTube subscriptions you want to
   mirror. Click **Continue** on the "app not verified" warning (expected for Testing-mode apps).
5. **Step 2** — **Exchange authorization code for tokens**.
6. Copy **`refresh_token`** (not `access_token`) into `.env` as `GOOGLE_OAUTH_REFRESH_TOKEN`.
7. **Rebuild & Reload App** (SwiftBar) or restart server after `.env` changes.

**Playground UI notes**

- **Auto-refresh the token before it expires** — Playground-only; leave unchecked; LLAAB does its
  own token exchange.
- If **Use your own OAuth credentials** is unchecked, Playground uses Google's built-in client —
  tokens will **not** match your `.env` client and will fail with `invalid_grant`.

---

## Verify

From repo root:

```bash
pnpm exec tsx -e "
(async () => {
  const { loadMonorepoEnv } = await import('./packages/ingestion/src/load-monorepo-env.ts');
  const { checkYouTubeSubscription } = await import('./packages/ingestion/src/fetch/youtube-subscription.ts');
  loadMonorepoEnv();
  const id = 'UCm4Sy7W36u_ZFOZWX9cd07w'; // Agent Zero — swap for any UC… channel id
  const r = await checkYouTubeSubscription(id);
  console.log(r ?? 'no result (OAuth vars missing or bad channel id)');
})().catch((e) => console.error(e.message));
"
```

Expected when subscribed: `{ subscribed: true, source: 'oauth' }`.

Then hard-refresh `/ingest` or open `/vault/sources/<id>` — enrich should write
`youtube_subscribed: true` to the source markdown file. `/ingest` shows enrich failures in alerts
between the form and runs table.

---

## Renew a broken refresh token

Symptom: `invalid_grant` on token exchange, missing `youtube_subscribed` on new sources, amber
**YouTube subscription check failed** alert on `/ingest`.

1. Confirm Client ID, secret, and redirect URI still match (see [Prerequisites](#prerequisites)).
2. Re-run [Initial setup](#initial-setup-oauth-playground) — same Web client, **Offline** + **Consent
   Screen**, copy new `refresh_token` to `.env`.
3. Rebuild & reload server; verify with [Verify](#verify) above.

### Common `invalid_grant` causes

| Cause                                                                                        | Fix                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Playground used **without** "Use your own OAuth credentials"                                 | Re-authorize with own client checked       |
| OAuth app in **Testing** — refresh token expired (~7 days inactive)                          | Re-issue token; consider adding test users |
| Client secret rotated in Cloud Console                                                       | Update `.env` secret + new refresh token   |
| App access revoked at [Google account permissions](https://myaccount.google.com/permissions) | Re-authorize in Playground                 |
| New refresh token issued (Google invalidates older ones)                                     | Update `.env` with latest `refresh_token`  |

---

## Key files

| File                                                   | Role                                    |
| ------------------------------------------------------ | --------------------------------------- |
| `packages/ingestion/src/fetch/youtube-subscription.ts` | Token exchange + subscription lookup    |
| `packages/ingestion/src/enrich/source-metadata.ts`     | Enrich orchestration                    |
| `apps/server/src/routes/vault/vault-sources.routes.ts` | `POST /sources/:id/enrich`              |
| `apps/client/src/routes/ingest.tsx`                    | Background enrich + error alerts        |
| `apps/client/src/routes/source-detail.tsx`             | Enrich on load + `subscriptionError` UI |

See also: [06 — YouTube transcript ingestion](/docs/06_YOUTUBE_TRANSCRIPT_INGESTION.md) (ingest
pipeline, separate from subscription enrich).
