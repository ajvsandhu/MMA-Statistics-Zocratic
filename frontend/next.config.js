/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: false
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