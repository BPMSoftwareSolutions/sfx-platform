import { readValidatedPublication } from '@/lib/publication-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-SideFX-Release': process.env.SIDEFX_RELEASE_REVISION ?? 'development',
  };
  try {
    readValidatedPublication();
    const maxAge = Number(process.env.SIDEFX_MAX_PUBLICATION_AGE_DAYS ?? 30);
    if (!Number.isFinite(maxAge) || maxAge < 0) throw new Error('Invalid freshness configuration');
    // Staleness is a content notice, not an outage. Optional authoring/mail services have separate gates.
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
