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
  }
};

module.exports = nextConfig; 