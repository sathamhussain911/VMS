/** @type {import('next').NextConfig} */

const nextConfig = {
  // Static export — works with Cloudflare Pages out of box, zero config needed
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
