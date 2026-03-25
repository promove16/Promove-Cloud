FROM node:20-alpine AS build

WORKDIR /app

COPY Server/package*.json ./
RUN npm ci

COPY Server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 10000

CMD ["npm", "start"]
