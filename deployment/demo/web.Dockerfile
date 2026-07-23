FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
ARG VITE_API_URL=http://localhost:18081/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @erp/web build

FROM nginx:1.29-alpine
COPY deployment/demo/demo-nginx.conf /etc/nginx/conf.d/default.conf
COPY deployment/demo/demo-entry.html /usr/share/nginx/html/demo/index.html
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN printf 'ok\n' > /usr/share/nginx/html/demo-health
EXPOSE 8080

