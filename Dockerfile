# Two-stage build for a wip-deploy-installable app.
# Stage 1 builds the SPA at Vite's default base '/'; stage 2 runs the Express
# server (via tsx), which in production also serves the built SPA from ./dist.
# The app is served at the root of its own origin: there is no base path.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY libs ./libs
RUN npm ci
COPY . .
# Build stamp (CASE-472) — baked from CI --build-arg; 'dev' default hides it.
ARG VITE_BUILD_STAMP=dev
ARG VITE_BUILD_SHA=dev
ENV VITE_BUILD_STAMP=${VITE_BUILD_STAMP}
ENV VITE_BUILD_SHA=${VITE_BUILD_SHA}
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3016)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run tsx by path, not through npx: the image must start without fetching
# anything from the npm registry (tsx is a runtime dependency).
CMD ["./node_modules/.bin/tsx", "server/index.ts"]
