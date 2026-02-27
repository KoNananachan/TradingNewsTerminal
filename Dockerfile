# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

COPY server/ server/
COPY client/ client/

RUN npm run build -w client
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN npm run build -w server

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

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

ENV NODE_ENV=production
EXPOSE 8080

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --skip-generate && node dist/index.js"]
