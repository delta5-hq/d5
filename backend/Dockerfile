FROM node:16-bullseye

RUN apt-get update && \
    apt-get install --no-install-recommends -y openjdk-11-jre=11.0.28+6-1~deb11u1 graphviz=2.42.2-5+deb11u1 fontconfig=2.13.1-4.2 fonts-dejavu=2.37-2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY assets/ ./assets/
COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY build/ ./

RUN mkdir -p /app/cache && \
    chown -R nobody:nogroup /app/cache

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
    DEBUG="delta5:*" \