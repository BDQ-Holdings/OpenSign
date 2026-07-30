FROM node:22.14.0-bookworm-slim AS build

WORKDIR /usr/src/app

COPY apps/OpenSign/package.json apps/OpenSign/package-lock.json ./
RUN npm ci

COPY apps/OpenSign/ ./

ARG OPENSIGN_VERSION=v2.41.0
RUN printf '%s\n' "$OPENSIGN_VERSION" > public/version.txt \
  && NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/vite build \
  && sed -i '/<head>/a\<script src="/env.js"></script>' build/index.html

FROM node:22.14.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/build ./build
COPY apps/OpenSign/server.cjs apps/OpenSign/entrypoint.sh ./

RUN chmod 0555 entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.cjs"]
