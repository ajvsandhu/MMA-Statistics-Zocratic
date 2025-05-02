/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: false
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.tapology.com',
      },
      {
        protocol: 'https',
        hostname: 'static1.cbrimages.com',
      },
      {
        protocol: 'https',
        hostname: '**.ufc.com',
      }
    ],
    unoptimized: true
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
      '@tailwindcss/oxide': false
    }
    return config
  },
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://www.zocraticmma.com',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate'
          }
        ]
      }
    ]
  }
};

module.exports = nextConfig; 