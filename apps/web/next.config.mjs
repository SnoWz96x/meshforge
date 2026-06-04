/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite servir as imagens geradas pela API (assets) sem otimização do Next.
  images: { unoptimized: true },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    return [{ source: "/api-proxy/:path*", destination: `${api}/:path*` }];
  },
};
export default nextConfig;
