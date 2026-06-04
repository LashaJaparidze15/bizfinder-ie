/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace shared package (it ships TS source).
  transpilePackages: ["@bizfinder/shared"],
  reactStrictMode: true,
};

export default nextConfig;
