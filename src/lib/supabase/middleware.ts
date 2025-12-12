import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * ミドルウェア用Supabaseクライアント
 * 認証状態のリフレッシュとルート保護に使用
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションをリフレッシュ
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('Middleware Auth Check:', {
    path: request.nextUrl.pathname,
    hasUser: !!user,
    email: user?.email
  });

  // 認証が必要なルートの保護
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  
  // ログインページ以外はすべて保護対象（トップページ含む）
  if (!user && !isAuthRoute) {
    // 未認証ユーザーをログインページへリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // 認証済みユーザーをトップページへリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

