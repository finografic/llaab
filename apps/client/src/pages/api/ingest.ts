import { ingestYouTube } from '@llaab/skills';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { url?: string };

  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return json({ success: false, error: 'Invalid request body.' }, 400);
  }

  const { url } = body;

  if (!url?.trim()) {
    return json({ success: false, error: '`url` is required.' }, 400);
  }

  try {
    const { record, result } = await ingestYouTube({ url: url.trim() });

    if (record.status === 'failed') {
      return json({ success: false, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    const reused = result.runTrace?.stages.some((s) => s.name === 'dedupe:transcript') ?? false;

    return json({
      success: true,
      result: {
        id: result.id,
        path: result.path,
        type: result.type,
        reused,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message }, 500);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
