FROM node:22-bullseye

WORKDIR /app

COPY assets/ ./assets/

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY build/ ./

USER nobody

CMD ["node", "index.js"]

ENV ENABLE_USER_AUTH=0 \
    JWT_SECRET="JWT-SECRET" \
    JWT_TTL="" \
    FRONTEND_PATH="" \
    MONGO_HOST="" \
    MONGO_PORT="" \
    MONGO_USERNAME="" \
    MONGO_PASSWORD="" \
    MONGO_DATABASE="" \
    PORT=3000 \
    DEBUG="infinity:*"
