// Local lab host. The platform admits runs through the SDA run API; this only serves Next.
import { spawn } from 'node:child_process';

const port = process.env.SIDEFX_LAB_PORT ?? '3010';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: 'inherit',
  env: { ...process.env, SIDEFX_LAB_ENABLED: '1' },
});
console.log(JSON.stringify({
  lab: `http://127.0.0.1:${port}/lab`,
  sdaApi: process.env.SDA_API_ENDPOINT ?? null,
  estatePublication: 'unchanged',
}));
const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => { process.exitCode = code ?? 0; });
