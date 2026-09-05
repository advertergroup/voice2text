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
      { source: "/audio/to-text", destination: "/en/l/audio-to-text", statusCode: 301 },
      { source: "/audio-to-text", destination: "/en/l/audio-to-text", statusCode: 301 },
      { source: "/mp3/to-text", destination: "/en/l/mp3-to-text", statusCode: 301 },
      { source: "/mp3-to-text", destination: "/en/l/mp3-to-text", statusCode: 301 },
    ];
  },
};
export default nextConfig;
