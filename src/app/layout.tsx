import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskBoard',
  description: 'クリニックスタッフ向け業務引き継ぎ・日報共有アプリ TaskBoard',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/favicon.ico', // ← ここでファビコンを指定！
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}

