FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run prisma:generate
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/assets ./seed-assets
COPY --from=builder /app/scripts/ensure-seed-media.mjs ./scripts/ensure-seed-media.mjs
COPY --from=builder /app/scripts/sync-store-identity.mjs ./scripts/sync-store-identity.mjs
COPY --from=builder /app/scripts/serve-dist.mjs ./scripts/serve-dist.mjs

EXPOSE 3000

CMD ["sh", "-c", "node scripts/ensure-seed-media.mjs && node scripts/sync-store-identity.mjs && node scripts/serve-dist.mjs"]
