FROM nginx:1-alpine

RUN echo "server {listen 80; root /html/; \
          location / {try_files \$uri /index.html;}}" > /etc/nginx/conf.d/default.conf

COPY ./dist /html
COPY ./env-config.sh /docker-entrypoint.d/env-config.sh

RUN chmod +x /docker-entrypoint.d/env-config.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

ENV API_ROOT=""