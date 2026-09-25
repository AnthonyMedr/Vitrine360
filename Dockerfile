FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
# Coolify may inject NODE_ENV=production during the image build. Explicitly
# include development dependencies because Vite and Prisma CLI are build tools.
RUN npm ci --include=dev
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/scripts/bootstrap-admin-user.ts ./scripts/bootstrap-admin-user.ts
COPY --from=build --chown=node:node /app/scripts/seed-catalog.ts ./scripts/seed-catalog.ts
COPY --from=build --chown=node:node /app/scripts/migrate-product-media-to-object-storage.ts ./scripts/migrate-product-media-to-object-storage.ts

USER node
EXPOSE 3001

# Apply pending database migrations and make the configured administrator safe
# before accepting traffic. Both operations are idempotent across redeploys.
CMD ["sh", "-c", "npm run db:migrate:deploy && npm run admin:bootstrap -- --no-reset-password && exec npm run start:production"]
