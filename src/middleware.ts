// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 認証が不要なパスを定義
  const publicPaths = [
    '/login',
    '/register',
    '/manifest.json',  // 追加
    '/images/favicon.ico'  // 必要に応じて追加
  ];

  // 認証不要なパスの場合はスキップ
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // セッション確認などの認証処理
  // ...既存の認証処理...

  return NextResponse.next();
}

// ミドルウェアを適用するパスの設定
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
};