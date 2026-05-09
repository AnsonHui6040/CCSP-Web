/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a Node built-in (stable in Node 22.5+, used here on Node 24).
  // No bundler treatment is needed.
  devIndicators: false,
};

export default nextConfig;
