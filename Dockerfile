# Two-stage build for a wip-deploy-installable query app (CASE-370).
# Stage 1 builds the SPA; stage 2 runs the Express server (via tsx), which in
# production also serves the built SPA from ./dist under APP_BASE_PATH.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY libs ./libs
RUN npm ci
COPY . .
# Deploy path prefix baked into the static bundle (wip-deployable contract).
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build          # vite build → /app/dist

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# wget for the container healthcheck — node:22-slim ships neither curl nor
# wget, so the wip-deploy-rendered probe (curl-or-wget) exits 127 and the
# container reports permanently unhealthy (alpine-based apps get wget via
# busybox for free).
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
# Reuse the resolved deps from the build stage (includes tsx, used at runtime).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY server ./server

EXPOSE 3016
# Health endpoint is mounted under APP_BASE_PATH (default '' → '/api/health').
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3016)+(process.env.APP_BASE_PATH||'')+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "server/index.ts"]
