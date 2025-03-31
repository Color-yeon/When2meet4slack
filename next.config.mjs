const nextConfig = {
  experimental: {
    serverActions: true,
  },
  // 이미지 최적화 설정
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  // 성능 최적화 설정
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // 번들 크기 분석 활성화
  webpack: (config, { isServer }) => {
    if (!isServer && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        analyzerPort: 8888,
        openAnalyzer: true,
      }));
    }
    return config;
  },
}

export default nextConfig

