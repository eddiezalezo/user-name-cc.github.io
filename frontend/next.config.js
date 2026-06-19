/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // En dev, libsodium-wrappers necesita poder inicializarse en el cliente sin SSR estricto.
  experimental: {},
};

module.exports = nextConfig;
