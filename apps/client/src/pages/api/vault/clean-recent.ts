import { cleanRecentVaultActivity } from '@llaab/core';
import type { APIRoute } from 'astro';

export const prerender = false;

function parseHours(body: unknown): number | null {
  if (typeof body !== 'object' || body === null || !('hours' in body)) return null;

  const { hours } = body as { hours?: unknown };
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 8760) {
    return null;
  }

  return hours;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hours = parseHours(body);
  if (hours === null) {
    return new Response(JSON.stringify({ success: false, error: 'Enter a positive number of hours.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const removedCount = await cleanRecentVaultActivity(hours);
    return new Response(JSON.stringify({ success: true, removedCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vault clean failed.';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
