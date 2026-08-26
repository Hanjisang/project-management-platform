FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-constants/package.json packages/shared-constants/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages packages
RUN npm run db:generate && npm run build -w @pmp/shared-types && npm run build -w @pmp/shared-constants && npm run build -w @pmp/shared-utils && npm run build -w @pmp/api && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=build /app/apps/api/prisma ./apps/api/prisma
# The runtime seed is executed through tsx and reuses the production StorageProvider implementation.
COPY --chown=node:node --from=build /app/apps/api/src ./apps/api/src
COPY --chown=node:node --from=build /app/packages ./packages
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate:deploy -w @pmp/api && npm run db:seed -w @pmp/api && node apps/api/dist/src/main.js"]
