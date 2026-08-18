# Imagen web para Voice2Text. Node 24 (ejecuta scripts .ts nativos: seed).
FROM node:24-bookworm-slim
WORKDIR /app

# openssl (Prisma) + ffmpeg (audio/vídeo) + python + pip (Whisper local).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates ffmpeg python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Motor de transcripción local GRATIS (faster-whisper) + yt-dlp con:
#  - curl_cffi (impersonation → desbloquea Dailymotion, X/Twitter y otros sitios)
#  - bgutil-ytdlp-pot-provider (PO tokens para YouTube; requiere el servicio bgutil del compose)
# El modelo de Whisper se descarga en primer uso y persiste en el volumen /root/.cache.
RUN pip3 install --no-cache-dir --break-system-packages \
    whisper-ctranslate2 "yt-dlp[default,curl-cffi]" curl_cffi bgutil-ytdlp-pot-provider

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
