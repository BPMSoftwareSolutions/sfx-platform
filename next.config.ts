import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./generated/*.json'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async redirects() {
    return [
      ...(process.env.SIDEFX_HF_SPACE === '1' ? [{ source: '/', destination: '/workbench/index.html', permanent: false }] : []),
      // §2.1 / §5.10 — the acronym route is a permanent redirect with no duplicate indexable content.
      { source: '/mcp', destination: '/managed-capability-provider', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(process.env.SIDEFX_HF_SPACE === '1'
            ? [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://huggingface.co" }]
            : [{ key: 'X-Frame-Options', value: 'DENY' }]),
        ],
      },
      {
        source: '/media/library/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // §4 — private/auth routes are excluded from search indexing.
        source: '/(workspace|sign-in|auth)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
