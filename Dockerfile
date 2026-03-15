# ── Stage 1: deps ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests only — lets Docker cache this layer until package.json changes
COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# ── Stage 2: runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Set NODE_ENV so any library that checks it behaves correctly
ENV NODE_ENV=production

WORKDIR /app

# Bring in production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

EXPOSE 5000

# Run with plain node — nodemon is a devDependency and not needed here
CMD ["node", "src/server.js"]
