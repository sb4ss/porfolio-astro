import type { APIRoute } from 'astro';
import { createGithubLoader } from '../../server/github.mjs';

export const prerender = false;
const load = createGithubLoader();
export const GET: APIRoute = async () => {
  const data = await load();
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': data.repository && data.activity
        ? 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'
        : 'public, max-age=60, s-maxage=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
