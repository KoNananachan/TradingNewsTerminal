# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

ARG VITE_GOOGLE_CLIENT_ID=""

COPY server/ server/
COPY client/ client/

ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build -w client
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN npm run build -w server

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Security: add non-root user
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001 -G appuser

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci --omit=dev

# Prisma: generated client + CLI (for db push at startup) + schema
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/prisma node_modules/prisma
COPY server/prisma server/prisma

# Built artifacts
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist client/dist

# Ensure data directory is writable
RUN mkdir -p /app/server/prisma && chown -R appuser:appuser /app

ENV NODE_ENV=production
EXPOSE 8080

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get('http://localhost:8080/api/health',(res)=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

USER appuser
WORKDIR /app/server
CMD ["sh", "-c", "node dist/scripts/restore-db.js && npx prisma db push --schema=prisma/schema.prisma --skip-generate && node dist/index.js"]
