/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["docx"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Subidas grandes de audio/vídeo a los route handlers.
  experimental: { serverActions: { bodySizeLimit: "600mb" } },
};
export default nextConfig;
