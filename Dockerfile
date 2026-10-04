# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV STANDALONE_OUTPUT=1
# Dummy build-time env (real values come from runtime environment).
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
ARG BETTER_AUTH_SECRET="docker-build-dummy-secret-min-32-chars"
ARG BETTER_AUTH_URL="http://localhost:3000"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
