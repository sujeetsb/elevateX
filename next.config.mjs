/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // pdf-parse pulls pdfjs-dist; bundling them breaks App Router with
    // "Object.defineProperty called on non-object" — load from node_modules at runtime.
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
      '@prisma/client',
      'bcryptjs',
      'pdf-parse',
      'pdfjs-dist',
    ],
  },
};

export default nextConfig;
