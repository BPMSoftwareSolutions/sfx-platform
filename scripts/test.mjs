import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Explicit enumeration works on Windows Node 20 as well as the pinned Linux runtime.
for (const extension of ['mjs', 'ts']) {
  const files = readdirSync('tests').filter(name => name.endsWith(`.test.${extension}`)).map(name => `tests/${name}`);
  const loader = extension === 'ts' ? ['--import', 'tsx'] : [];
  const result = spawnSync(process.execPath, [...loader, '--test', ...files], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
