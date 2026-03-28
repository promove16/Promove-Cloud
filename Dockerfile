FROM node:20.20.0-alpine3.22 AS server-build

WORKDIR /app

COPY Server/package*.json ./
RUN npm ci

COPY Server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:20.20.0-alpine3.22 AS client-build

WORKDIR /app

COPY Client/package*.json ./
RUN npm ci

COPY Client/ ./
RUN npm run build

FROM node:20.20.0-alpine3.22 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=server-build /app/package*.json ./
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=client-build /app/dist ./public

EXPOSE 10000

CMD ["npm", "start"]
