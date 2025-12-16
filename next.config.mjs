/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase画像ホスティング用の設定（必要に応じて）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  output: 'standalone',
};

export default nextConfig;

