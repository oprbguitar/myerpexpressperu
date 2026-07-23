FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile=false
COPY apps/worker apps/worker
COPY packages/database packages/database
RUN pnpm --filter @erp/worker... build
CMD ["pnpm","--filter","@erp/worker","start"]
