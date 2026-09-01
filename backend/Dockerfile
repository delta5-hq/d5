FROM node:22-bookworm

WORKDIR /app

COPY assets/ ./assets/

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY build/ ./

# The official Node image provides the unprivileged `nobody` account. Keep the
# image-owned name portable across architectures instead of pinning a numeric UID.
# hadolint ignore=DL3066
USER nobody

CMD ["node", "index.js"]

ENV ENABLE_USER_AUTH=0 \
    JWT_TTL="" \
    FRONTEND_PATH="" \
    MONGO_HOST="" \
    MONGO_PORT="" \
    MONGO_DATABASE="" \
    PORT=3000 \
    DEBUG="infinity:*"
