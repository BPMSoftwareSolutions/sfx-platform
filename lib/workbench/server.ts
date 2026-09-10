import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const enabled = () => process.env.SIDEFX_LAB_ENABLED === '1';
export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get('origin');
    return !!origin && new URL(origin).origin === new URL(process.env.SIDEFX_LAB_ORIGIN ?? request.url).origin;
  } catch { return false; }
}
export async function session(create = false) {
  const secret = process.env.SIDEFX_SERVICE_TOKEN;
  if (!secret) throw new Error('SERVICE_UNCONFIGURED');
  const sign = (id: string) => createHmac('sha256', secret).update('workbench-session:' + id).digest('hex');
  const jar = await cookies(), value = jar.get('sidefx-workbench')?.value ?? '';
  const [id, signature] = value.split('.');
  if (typeof id === 'string' && typeof signature === 'string' && /^[a-f0-9]{64}$/.test(id) && /^[a-f0-9]{64}$/.test(signature)
    && timingSafeEqual(Buffer.from(sign(id)), Buffer.from(signature))) return id;
  if (!create) return null;
  const next = randomBytes(32).toString('hex');
  jar.set('sidefx-workbench', next + '.' + sign(next), { httpOnly: true, secure: process.env.SIDEFX_HF_SPACE === '1',
    sameSite: process.env.SIDEFX_HF_SPACE === '1' ? 'none' : 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return next;
}
export async function remote(route: string, owner: string, body?: string) {
  return fetch(new URL(route, process.env.SIDEFX_INVOCATION_ENDPOINT), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: 'Bearer ' + process.env.SIDEFX_SERVICE_TOKEN, 'x-workbench-session': owner,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
}
export async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BODY_REQUIRED');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
