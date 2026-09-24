# Next.js standalone build for Protoship.
#
# Next.js is off-template on this platform, but the contract is only "listen on
# 8080 and return 2xx on the probe path" - CI builds whatever this file says.
#
# Node 24 (Active LTS, EOL 2028-04-30). This image was on node:20-alpine until
# 2026-09-23, five months AFTER Node 20 went end-of-life on 2026-04-30, so it
# was running production on a runtime receiving no security patches. Keep this
# on a supported LTS and keep .nvmrc in step with it, or local and production
# drift apart again.
#
# Three things this must get right; all three have bitten:
#  1. `output: 'standalone'` traces a minimal node_modules, keeping the
#     container inside the 200MB default (measured ~98MB RSS).
#  2. Next does NOT copy .next/static or public/ into the standalone output.
#     Without them no client JS loads and every onClick is silently dead.
#  3. CMD must be an ABSOLUTE path: GDP does not preserve WORKDIR, so
#     `node server.js` dies with "Cannot find module '/server.js'".
#
# There are NO native modules in the graph any more. better-sqlite3 was the
# only one and was removed on 2026-09-23 along with the SQLite driver; it had
# caused two outages (no compiled binary under --ignore-scripts killed the pod
# at boot, and excluding it from tracing left a dangling symlink that COPY
# followed and failed on). The dev-dependency prune below is kept anyway: it
# keeps the image small and stops the next native module repeating the story.

FROM node:24-alpine AS builder
WORKDIR /app

# Full install (including dev deps) - the build needs typescript/tailwind.
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Drop dev dependencies BEFORE the runner stage copies anything: smaller image,
# and no test-only package can reach production even if one is added later.
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# Keep V8's heap under the cgroup limit so an OOM is a clean JS error rather
# than a silent SIGKILL that stalls the readiness probe.
ENV NODE_OPTIONS="--max-old-space-size=300"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Schema for reference; DDL is applied out-of-band via execute_sql.
COPY --from=builder /app/sql ./sql

RUN addgroup -g 1001 -S appuser \
    && adduser -S appuser -u 1001 -G appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080
# ABSOLUTE path, deliberately. GDP does not preserve the image's WORKDIR when it
# runs the container, so a relative CMD resolves against / and dies with
# "Cannot find module '/server.js'" in a crash loop. Every one of the 85 apps on
# this platform uses an absolute CMD; this is a platform contract, not a style
# choice. Do not shorten this back to "server.js".
CMD ["node", "/app/server.js"]
