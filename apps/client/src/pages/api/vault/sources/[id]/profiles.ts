import { getNodeFilePath, updateNode } from '@llaab/core';
import { SourceProfileSchema, z } from '@llaab/schemas';
import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'vault_key';

const updateSourceProfilesBodySchema = z.object({
  profiles: z.array(SourceProfileSchema),
});

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const password = import.meta.env.VAULT_PASSWORD ?? 'llaab';
  const cookie = cookies.get(COOKIE_NAME);

  if (cookie?.value !== password) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Source id is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = updateSourceProfilesBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid profiles payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sourcePath = getNodeFilePath('source', id);

  try {
    const result = await updateNode(sourcePath, (current) => {
      if (current.type !== 'source') {
        throw new Error('Source not found');
      }

      const profilePlatforms = new Set(parsed.data.profiles.map((profile) => profile.platform));
      const platforms = [
        ...new Set([...current.platforms.filter((platform) => platform !== 'github'), ...profilePlatforms]),
      ];

      return {
        ...current,
        platforms,
        profiles: parsed.data.profiles,
      };
    });

    return new Response(JSON.stringify({ source: result.node }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to update source profiles.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
