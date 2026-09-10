import { boundedBody, enabled, remote, sameOrigin, session } from '@/lib/workbench/server';
export async function POST(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const owner = await session();
  if (!owner) return Response.json({ code: 'SESSION_REQUIRED' }, { status: 401 });
  let body: string;
  try { body = await boundedBody(request); JSON.parse(body); }
  catch { return Response.json({ code: 'INVALID_REQUEST' }, { status: 400 }); }
  try {
    const result = await remote('/runs', owner, body);
    return new Response(await result.text(), { status: result.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch { return Response.json({ disposition: 'UNCERTAIN', code: 'ADMISSION_UNCERTAIN', message: 'Run admission is unknown. Reconcile the same request; do not submit a new one.' }, { status: 502 }); }
}
