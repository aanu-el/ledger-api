# ---- deps: full install for building ---------------------------------------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# postinstall runs `prisma generate`, which needs the schema present.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compile TypeScript (including the generated Prisma client) ------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# ---- prod-deps: production dependencies only --------------------------------
FROM node:22-alpine AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Install scripts run here (as root) so Prisma's native schema engine, which
# `migrate deploy` needs, is present in the image; `prisma generate` also runs
# and needs the schema.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---- runtime: one image, several entrypoints --------------------------------
# The same image runs `api`, `worker` and `migrate`; Compose and Render pick
# the command. `prisma` ships as a runtime dependency so `migrate deploy`
# can run from this image.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health >/dev/null || exit 1
CMD ["node", "dist/entrypoints/api.js"]
