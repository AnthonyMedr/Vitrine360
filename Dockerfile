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

USER node
EXPOSE 3001

CMD ["npm", "run", "start:production"]
