import { enabled, sameOrigin, session } from '@/lib/workbench/server';
export async function POST(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  await session(true);
  return Response.json({ ready: true }, { headers: { 'cache-control': 'no-store' } });
}
