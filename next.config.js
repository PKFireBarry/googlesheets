/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'kg.diffbot.com',
      'logo.clearbit.com',
      'www.google.com',
      'upload.wikimedia.org',
      'media.licdn.com',
      'assets.website-files.com',
      'images.crunchbase.com',
      'cdn.worldvectorlogo.com',
      'companieslogo.com',
      'avatars.githubusercontent.com',
      'res.cloudinary.com',
      'media.glassdoor.com',
      'rmkcdn.successfactors.com',
      'storage.googleapis.com',
      's6-recruiting.cdn.greenhouse.io',
      'vwr.wd1.myworkdayjobs.com',
    ],
    // Allow all domains for images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Wildcard to allow any domain
      },
    ],
  },
  // Adding ESLint configuration to ignore errors during build
  eslint: {
    // Warning instead of error during build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
