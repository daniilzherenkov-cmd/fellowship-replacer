# Next.js standalone build for Protoship.
#
# Next.js is off-template on this platform, but the contract is only "listen on
# 8080 and return 2xx on the probe path" - CI builds whatever this file says.
#
# Four things this must get right; all four have bitten:
#  1. `output: 'standalone'` traces a minimal node_modules, keeping the
#     container inside the 200MB default (measured ~98MB RSS).
#  2. Next does NOT copy .next/static or public/ into the standalone output.
#     Without them no client JS loads and every onClick is silently dead.
#  3. better-sqlite3 is a test-only NATIVE module. Installed with
#     --ignore-scripts it has no compiled binary, and importing it kills the
#     server at boot - the pod never passes readiness and the edge reports
#     "no healthy upstream". Dev dependencies are pruned before tracing so it
#     is never part of the production graph at all.
#  4. Excluding a package via outputFileTracingExcludes alone leaves a DANGLING
#     SYMLINK in .next/standalone, and `COPY` follows it and fails the build.
#     Pruning (3) removes the package before tracing, so no link is created.

FROM node:20-alpine AS builder
WORKDIR /app

# Full install (including dev deps) - the build needs typescript/tailwind.
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Drop dev dependencies BEFORE the runner stage copies anything, so no
# test-only native module can reach the image.
RUN npm prune --omit=dev --ignore-scripts

FROM node:20-alpine AS runner
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
CMD ["node", "server.js"]
