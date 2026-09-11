import { enabled } from '@/lib/workbench/server';
import { estateCatalogue } from '@/lib/workbench/estate';

/* The capability catalogue, derived from selected database authority. The
 * workbench package carries no estate data; it asks for this at load. */
export async function GET() {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    return Response.json(await estateCatalogue(), {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
    });
  } catch {
    return Response.json({ code: 'ESTATE_UNAVAILABLE' }, { status: 503 });
  }
}
