
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src
COPY config ./config
COPY models ./models
COPY migrations ./migrations
COPY scripts ./scripts
COPY seeds ./seeds
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
