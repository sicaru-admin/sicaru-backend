# ── Stage 1: Install all dependencies ──────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build Medusa ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx medusa build

# ── Stage 3: Production runner ────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat
RUN addgroup --system medusa && adduser --system --ingroup medusa medusa

WORKDIR /app

# Copy production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build output and runtime config
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/medusa-config.ts ./
COPY --from=builder /app/instrumentation.ts ./

RUN chown -R medusa:medusa /app
USER medusa

EXPOSE 9000

ENV NODE_ENV=production

CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
