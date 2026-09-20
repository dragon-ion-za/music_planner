# ── Stage 1: Build Angular frontend ──────────────────────────────────────────
FROM node:20-alpine AS angular-builder
WORKDIR /app/music-planner-app
COPY music-planner-app/package*.json ./
RUN npm ci
COPY music-planner-app/ ./
RUN npm run build

# ── Stage 2: Build Node API ───────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /app/music-planner-api
COPY music-planner-api/package*.json ./
RUN npm ci
COPY music-planner-api/ ./
RUN npm run build

# ── Stage 3: Angular nginx runner ─────────────────────────────────────────────
FROM nginx:alpine AS angular-runner
COPY --from=angular-builder /app/music-planner-app/dist/music-planner/browser /usr/share/nginx/html
COPY music-planner-app/nginx.conf /etc/nginx/conf.d/default.conf

# ── Stage 4: API runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS api-runner
WORKDIR /app
COPY --from=api-builder /app/music-planner-api/dist ./dist
COPY --from=api-builder /app/music-planner-api/node_modules ./node_modules
# Seed data assets (e.g. repertoire.json) read at runtime by the song seed.
# seedSongs resolves this as dist/../assets, i.e. /app/assets.
COPY --from=api-builder /app/music-planner-api/assets ./assets
EXPOSE 3000
CMD ["node", "dist/api/server.js"]
