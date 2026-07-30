FROM node:22.14.0-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY apps/OpenSignServer/package.json apps/OpenSignServer/package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY apps/OpenSignServer/ ./

# Railway mounts persistent uploads at /usr/src/app/files/files so the volume
# does not hide the email templates baked into /usr/src/app/files.
RUN mkdir -p /usr/src/app/files/files

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/app/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
