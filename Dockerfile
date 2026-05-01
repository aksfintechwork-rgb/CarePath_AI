# ============================================================================
# CarePath AI - Production Dockerfile
# Multi-stage build: install deps -> build -> minimal runtime image
# ============================================================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package manifests first for better layer caching
COPY package*.json ./

# Install ALL dependencies (including dev) for the build step
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the production bundle (Vite client + esbuild server -> dist/)
RUN npm run build

# Remove dev dependencies after build to slim things down
RUN npm prune --omit=dev


# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install only the runtime tools we need (curl for healthcheck)
RUN apk add --no-cache curl

# Copy production node_modules and built artifacts from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Copy any runtime assets the server reads at startup
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/public ./public

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 5000

# Simple healthcheck (your server should respond on /)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5000/ || exit 1

# Start the production server
CMD ["node", "dist/index.cjs"]
