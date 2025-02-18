import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'kg.diffbot.com',
      'logo.clearbit.com',
      'www.google.com',
      'linkedin.com',
      'deere.com',
      'media.glassdoor.com'
      // Add any other domains you expect company images to come from
    ],
  },
};

export default nextConfig;
