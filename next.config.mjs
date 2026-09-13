/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["docx"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Subidas grandes de audio/vídeo a los route handlers.
  experimental: { serverActions: { bodySizeLimit: "600mb" } },
  // Rutas visibles de los anuncios de Google Ads (display path) → landing real.
  // 301 permanente; la query (gclid, utm_*) se conserva sola, y el middleware
  // captura el gclid en la petición de DESTINO (los redirects corren antes).
  async redirects() {
    return [
      // EN
      { source: "/audio/to-text", destination: "/en/l/audio-to-text", statusCode: 301 },
      { source: "/audio-to-text", destination: "/en/l/audio-to-text", statusCode: 301 },
      { source: "/mp3/to-text", destination: "/en/l/mp3-to-text", statusCode: 301 },
      { source: "/mp3-to-text", destination: "/en/l/mp3-to-text", statusCode: 301 },
      // ES (idioma por defecto → SIN prefijo /es)
      { source: "/audio/a-texto", destination: "/l/audio-a-texto", statusCode: 301 },
      { source: "/mp3/a-texto", destination: "/l/mp3-a-texto", statusCode: 301 },
      { source: "/youtube/a-texto", destination: "/l/youtube-a-texto", statusCode: 301 },
      { source: "/tiktok/a-texto", destination: "/l/tiktok-a-texto", statusCode: 301 },
      // IT
      { source: "/audio/in-testo", destination: "/it/l/audio-in-testo", statusCode: 301 },
      { source: "/mp3/in-testo", destination: "/it/l/mp3-in-testo", statusCode: 301 },
      { source: "/youtube/in-testo", destination: "/it/l/youtube-in-testo", statusCode: 301 },
      { source: "/tiktok/in-testo", destination: "/it/l/tiktok-in-testo", statusCode: 301 },
      // DE
      { source: "/audio/in-text", destination: "/de/l/audio-in-text", statusCode: 301 },
      { source: "/mp3/in-text", destination: "/de/l/mp3-in-text", statusCode: 301 },
      { source: "/youtube/in-text", destination: "/de/l/youtube-in-text", statusCode: 301 },
      { source: "/tiktok/in-text", destination: "/de/l/tiktok-in-text", statusCode: 301 },
    ];
  },
};
export default nextConfig;
