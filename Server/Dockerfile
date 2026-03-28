FROM node:20.20.0-alpine3.22

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
