import type { Metadata, Viewport } from 'next';
import './globals.css';

// メタデータの基本設定
export const metadata: Metadata = {
  title: 'TaskBoard',
  description: 'クリニックスタッフ向け業務引き継ぎ・日報共有アプリ',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'TaskBoard - 業務引き継ぎ・日報共有アプリ',
    description: 'クリニックスタッフの業務効率化を支援する日報共有アプリ',
    url: '/',
    siteName: 'TaskBoard',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TaskBoard - 業務引き継ぎ・日報共有アプリ',
    description: 'クリニックスタッフの業務効率化を支援する日報共有アプリ',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/images/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" type="application/manifest+json" />
      </head>
      <body>{children}</body>
    </html>
  );
}