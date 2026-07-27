FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . ./

ENV NODE_ENV=production
EXPOSE 3030
CMD ["sh", "-c", "node scripts/migrate-round1-technical-audit.js && node scripts/ensure-admin.js && node server.js"]
