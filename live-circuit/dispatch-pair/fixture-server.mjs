#!/usr/bin/env node
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.FIXTURE_PORT ?? '8788', 10);
const passphrase = process.env.FIXTURE_CERT_PASSWORD ?? 'sfx-demo';
const pfxPath = path.join(here, 'certs', 'localhost.pfx');

if (!fs.existsSync(pfxPath)) {
  console.error(`FIXTURE_ERROR missing certificate ${pfxPath}; run setup-cert.ps1 first`);
  process.exit(1);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

const server = https.createServer(
  { pfx: fs.readFileSync(pfxPath), passphrase },
  async (req, res) => {
    const url = new URL(req.url ?? '/', `https://localhost:${port}`);
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/delay') {
        const raw = url.searchParams.get('ms');
        const ms = raw !== null && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : Number.NaN;
        if (!Number.isInteger(ms) || ms < 0 || ms > 30000) {
          sendJson(res, 400, { error: 'ms must be an integer between 0 and 30000' });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, ms));
        sendJson(res, 200, { fixture: 'delay', ms, at: new Date().toISOString() });
        return;
      }
      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      sendJson(res, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

server.on('error', (error) => {
  console.error(`FIXTURE_ERROR ${error.code ?? error.message}`);
  process.exit(1);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, '127.0.0.1', () => {
  console.log(`FIXTURE_READY https://localhost:${port}`);
});
