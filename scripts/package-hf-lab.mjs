import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), output = path.join(root, 'artifacts/deployment/huggingface');
const copy = async (source, destination = source) => {
  const target = path.join(output, destination); await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(path.join(root, source), target, { recursive: true });
};
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs', 'next.config.ts', 'app/globals.css', 'app/lab',
  'components/lab', 'contracts/lab.ts', 'contracts/invocation.ts', 'lib/lab', 'lib/capability-api.ts', 'generated/lab-publication.json',
  'app/workbench', 'lib/workbench', 'public/workbench', 'generated/workbench-publication.json']) await copy(file);
await copy('deploy/huggingface/layout.tsx', 'app/layout.tsx');
await copy('deploy/huggingface/Dockerfile', 'Dockerfile');
await copy('deploy/huggingface/README.md', 'README.md');
await fs.writeFile(path.join(output, '.dockerignore'), 'node_modules\n.next\n.git\n');
console.log(JSON.stringify({ directory: output }));
