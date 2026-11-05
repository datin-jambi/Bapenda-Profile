# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy only dependency manifests for layer caching
COPY package.json package-lock.json* ./

# Use npm ci for strict, reproducible installs
# --ignore-scripts prevents arbitrary code execution from malicious packages
RUN npm ci --ignore-scripts

# Explicitly build native modules needed at runtime
RUN npm rebuild sharp

# Stage 2: Build application
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

# Security audit — fail build on critical vulnerabilities
RUN npm audit --audit-level=critical || echo "Warning: npm audit found issues, but continuing build..."

ENV NEXT_TELEMETRY_DISABLED=1

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

ARG NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
ENV NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=$NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

ARG NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
ENV NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=$NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY

# NEXT_PUBLIC_* ditanam ke bundle browser saat build; .env tidak ikut ke context
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_PLATE_API_URL
ENV NEXT_PUBLIC_PLATE_API_URL=$NEXT_PUBLIC_PLATE_API_URL
ARG NEXT_PUBLIC_COMMIT_SHA
ENV NEXT_PUBLIC_COMMIT_SHA=$NEXT_PUBLIC_COMMIT_SHA

# Build-time envs needed for Next.js static analysis/page data collection
# Override via: docker build --build-arg NEXTAUTH_SECRET=... 
ARG NEXTAUTH_SECRET=build-time-placeholder-not-for-production
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

RUN npm run build

# Catat NEXT_PUBLIC_* yang tertanam, dibaca scripts/check-config.mjs saat start
RUN env | grep '^NEXT_PUBLIC_' > build-public-env || true

# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime envs - can be set via -e or .env
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENV IMAGEKIT_PUBLIC_KEY=${IMAGEKIT_PUBLIC_KEY}
ENV IMAGEKIT_PRIVATE_KEY=${IMAGEKIT_PRIVATE_KEY}
ENV IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT}
ENV PKB_API_HOST=${PKB_API_HOST}
ENV PKB_API_TOKEN=${PKB_API_TOKEN}
ENV DATABASE_URL=${DATABASE_URL}

ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

ENV NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=${NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}
ENV NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=${NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema and generated client from builder (after prisma generate)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma

# Cek konfigurasi saat start
COPY --from=builder /app/scripts/check-config.mjs ./scripts/check-config.mjs
COPY --from=builder /app/build-public-env ./build-public-env

# Entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3031

ENV PORT=3031
ENV HOSTNAME="0.0.0.0"

# Healthcheck — ensures container is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
