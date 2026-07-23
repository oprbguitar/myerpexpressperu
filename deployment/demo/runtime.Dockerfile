FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/security/package.json packages/security/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY apps/worker apps/worker
COPY packages packages
COPY migrations migrations

RUN pnpm --filter @erp/contracts build \
  && pnpm --filter @erp/domain build \
  && pnpm --filter @erp/security build \
  && pnpm --filter @erp/database build \
  && pnpm --filter @erp/api build \
  && pnpm --filter @erp/worker build \
  && pnpm store prune

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
