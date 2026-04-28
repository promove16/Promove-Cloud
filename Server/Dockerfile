FROM node:20.20.2-alpine3.22 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20.20.2-alpine3.22 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 5000

# Liveness check. ECS uses this to decide whether to restart the container.
# Uses wget (included in alpine) against /healthz which always returns 200.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/healthz || exit 1

# Run node directly as PID 1 so SIGTERM is delivered without an npm wrapper.
# Each ECS task definition overrides CMD for its service:
#   API:       node dist/src/api.js
#   Realtime:  node dist/src/realtime.js
#   Worker:    node dist/src/worker.js
#   Scheduler: node dist/src/scheduler.js
CMD ["node", "dist/src/api.js"]
