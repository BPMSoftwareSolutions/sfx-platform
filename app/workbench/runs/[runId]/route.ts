import { enabled, remote, session } from '@/lib/workbench/server';
import { presentRun } from '@/lib/workbench/presentation';
export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  const owner = await session(); if (!owner) return new Response(null, { status: 401 });
  const { runId } = await context.params;
  const cursor = new URL(request.url).searchParams.get('after') ?? '0';
  if (!/^run-[a-f0-9]{64}$/.test(runId) || !/^\d{1,8}$/.test(cursor)) return new Response(null, { status: 400 });
  try {
    const result = await remote('/runs/' + runId + '?after=' + cursor, owner);
    const body = await result.json();
    return Response.json(result.ok ? presentRun(body) : body, { status: result.status, headers: { 'cache-control': 'no-store' } });
  } catch { return Response.json({ code: 'STATUS_UNAVAILABLE' }, { status: 502 }); }
}
