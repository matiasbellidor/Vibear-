# Build context: the repo root (npm workspaces share one lockfile there).
FROM node:24-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/web --include-workspace-root=false
COPY apps/web apps/web
# Rewrites (/api -> API) are resolved at build time.
ARG API_URL=http://api:8000
ENV API_URL=$API_URL NEXT_OUTPUT=standalone
RUN npm run build --workspace apps/web

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
