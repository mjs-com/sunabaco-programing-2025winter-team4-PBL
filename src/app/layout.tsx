import type { Metadata, Viewport } from 'next';
import './globals.css';

// 修正前のコード
// export const metadata: Metadata = {
//   title: 'TaskBoard',
//   description: 'クリニックスタッフ向け業務引き継ぎ・日報共有アプリ TaskBoard',
//   manifest: '/manifest.json',
//   icons: {
//     icon: '/images/favicon.ico',
//   },
// };

// 修正後のコード
export const metadata: Metadata = {
  title: 'TaskBoard',
  description: 'クリニックスタッフ向け業務引き継ぎ・日報共有アプリ TaskBoard',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/favicon.ico',
  },
};

// 修正前のビューポート設定
// export const viewport: Viewport = {
//   width: 'device-width',
//   initialScale: 1,
//   maximumScale: 1,
//   userScalable: false,
//   themeColor: '#0ea5e9',
// };

// 修正後のビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}