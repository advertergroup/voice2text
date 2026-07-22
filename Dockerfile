# Imagen web para Voice2Text. Node 24 (ejecuta scripts .ts nativos: seed).
FROM node:24-bookworm-slim
WORKDIR /app

# openssl (Prisma) + ffmpeg (audio de vídeo) + yt-dlp (URLs) opcionales.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates ffmpeg python3 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
