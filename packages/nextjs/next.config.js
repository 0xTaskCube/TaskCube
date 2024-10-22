// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true, // 始终忽略 TypeScript 构建错误
  },
  eslint: {
    ignoreDuringBuilds: true, // 在构建过程中忽略 ESLint 错误
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    domains: ["upload.wikimedia.org", "telegram.org", "raw.githubusercontent.com", "cryptologos.cc"],
  },
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "x-middleware-prefetch",
            value: "off",
          },
        ],
      },
    ];
  },

  poweredByHeader: false,
  generateEtags: false,
  compress: false,
  api: {
    bodyParser: false,
  },
};

module.exports = nextConfig;
