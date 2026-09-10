import { loadLabPublication } from '@/lib/lab/publication';
import { runPublishedInput } from '@/lib/lab/invocation';
import { invokeCapability } from '@/lib/capability-api';

export async function POST(request: Request) {
  if (process.env.SIDEFX_LAB_ENABLED !== '1') return new Response(null, { status: 404 });
  // The local adapter accepts same-origin browser requests only. Remote access
  // still requires an authenticated deployment boundary.
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { sameOrigin = !!origin && (process.env.SIDEFX_LAB_ORIGIN
    ? new URL(origin).origin === new URL(process.env.SIDEFX_LAB_ORIGIN).origin
    : new URL(origin).host === request.headers.get('host') && new URL(origin).protocol === new URL(request.url).protocol); } catch { /* Refuse malformed origins. */ }
  if (!sameOrigin) return new Response(null, { status: 403 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return new Response(null, { status: 400 }); }
  const result = await runPublishedInput(loadLabPublication(), raw, invokeCapability);
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
