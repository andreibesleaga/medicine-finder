# Build the single-page app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Only for a separate static deployment; the Railway image serves /api itself.
ARG VITE_API_BASE=""
RUN npm run build

# Runtime: Node serves dist/ and /api (no npm dependencies at runtime)
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "server/index.js"]
