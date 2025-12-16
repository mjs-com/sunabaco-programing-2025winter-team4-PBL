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
  const isPendingPage = request.nextUrl.pathname === '/auth/pending';
  const isDeletedPage = request.nextUrl.pathname === '/auth/account-deleted';
  const isCallbackRoute = request.nextUrl.pathname.startsWith('/auth/callback');

  // ログインページ以外はすべて保護対象（トップページ含む）
  if (!user && !isAuthRoute && !isCallbackRoute) {
    // 未認証ユーザーをログインページへリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // 承認状態と削除状態をチェック (STAFFテーブルを参照)
    const { data: staff } = await supabase
      .from('STAFF')
      .select('is_active, is_deleted')
      .eq('email', user.email!)
      .single();

    // 削除済みユーザーの場合
    if (staff && staff.is_deleted) {
       // すでにDeletedページにいる場合は何もしない
       if (isDeletedPage) {
        return supabaseResponse;
      }

      // それ以外のページへのアクセスはDeletedページへリダイレクト
      const url = request.nextUrl.clone();
      url.pathname = '/auth/account-deleted';
      return NextResponse.redirect(url);
    }

    // 未承認ユーザーの場合 (削除済みでない場合のみチェック)
    if (staff && !staff.is_deleted && !staff.is_active) {
      // すでにPendingページにいる場合は何もしない
      if (isPendingPage) {
        return supabaseResponse;
      }
      
      // それ以外のページへのアクセスはPendingページへリダイレクト
      const url = request.nextUrl.clone();
      url.pathname = '/auth/pending';
      return NextResponse.redirect(url);
    }

    // 正常なユーザーが特殊ページ（Pending/Deleted）に来た場合、トップへ
    if (isPendingPage || isDeletedPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // 認証済みユーザーがログインページに来た場合、トップへ
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

