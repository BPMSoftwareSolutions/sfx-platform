import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // These existing mount effects restore browser-only state after SSR. Keep visible as migration
  // warnings while enabling the previously missing lint gate for the rest of the application.
  {
    files: ['components/estate/capability-circuit-panel.tsx', 'components/ide/intent-composer.tsx', 'components/shell/site-nav.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  // The illustrative-flow player drives the rendered SVG imperatively: it mutates refs mid-
  // animation, cancels in-flight frames through a token, and reports progress from inside the
  // loop. Those are the mechanics of the trace, not accidental patterns, so the compiler's
  // immutability and memoization rules are kept visible as warnings here rather than silenced.
  {
    files: ['components/topology/use-trace-player.ts'],
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // App Router's shared root layout is the document; the Pages Router rule does not apply.
  { files: ['app/layout.tsx'], rules: { '@next/next/no-page-custom-font': 'off' } },
  globalIgnores(['.next/**', 'generated/**', 'public/media/**', 'artifacts/**', 'next-env.d.ts']),
]);
