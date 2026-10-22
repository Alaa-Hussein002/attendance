/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@attendance/shared'],
  poweredByHeader: false,
  // The app does not use next/image. Disabling the optimizer removes a known
  // remote attack surface from the self-hosted Next.js server.
  images: { unoptimized: true },
};
