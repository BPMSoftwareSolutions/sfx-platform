# linux/amd64 manifest inspected 2026-09-08; update version and digest together.
FROM node:24.20.0-bookworm-slim@sha256:6642ef280aebc09c4541bee0b15c9f89f0f3f3c247ddee79ae1d37eddfdcbbaa AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build && npm run check

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
ARG SOURCE_COMMIT=unknown
ENV SIDEFX_RELEASE_REVISION=$SOURCE_COMMIT
LABEL org.opencontainers.image.source="https://github.com/BPMSoftwareSolutions/sfx-platform" \
      org.opencontainers.image.revision=$SOURCE_COMMIT
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/generated ./generated
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
