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
COPY apps/web apps/web
COPY packages packages
RUN npm run build -w @pmp/shared-types && npm run build -w @pmp/shared-constants && npm run build -w @pmp/shared-utils && npm run build -w @pmp/web

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
