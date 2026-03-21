# Stage 1 - builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 - runner
FROM nginx:alpine AS runner
COPY --from=builder /app/dist/music-planner /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
