FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8089

ENV NODE_ENV=production
ENV PORT=8089
# In docker-compose, the db service is named 'db'
ENV DATABASE_URL=postgres://h1b:postgres@db:5432/h1bfriend

CMD ["node", "dist/server.js"]