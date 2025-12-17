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
  const isResetPasswordPage = request.nextUrl.pathname === '/auth/reset-password';

  // ログインページ以外はすべて保護対象（トップページ含む）
  // ただし、パスワードリセットページはセッション確立後にアクセスするため許可
  if (!user && !isAuthRoute && !isCallbackRoute && !isResetPasswordPage) {
    // 未認証ユーザーをログインページへリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // 承認状態と削除状態をチェック (STAFFテーブルを参照)
    let { data: staff } = await supabase
      .from('STAFF')
      .select('staff_id, email, is_active, is_deleted')
      .eq('email', user.email!)
      .single();

    // Auth側のemailでSTAFFが見つからない場合、メール変更後の未同期を検出
    if (!staff) {
      const oldEmail = user.user_metadata?.old_email;
      const staffId = user.user_metadata?.pending_staff_id;

      // user_metadataにold_emailがある場合、メール変更後と判断してSTAFFを同期
      if (oldEmail || staffId) {
        // 方法1: staff_idで検索
        if (staffId) {
          const { data: staffById } = await supabase
            .from('STAFF')
            .select('staff_id, email, is_active, is_deleted')
            .eq('staff_id', staffId)
            .single();

          if (staffById) {
            // STAFFテーブルのemailを更新
            await supabase
              .from('STAFF')
              .update({ email: user.email })
              .eq('staff_id', staffId);
            
            // メタデータをクリーンアップ
            await supabase.auth.updateUser({
              data: { old_email: null, pending_staff_id: null }
            });

            staff = { ...staffById, email: user.email };
            console.log('Middleware: Synced STAFF email via staff_id');
          }
        }

        // 方法2: old_emailで検索
        if (!staff && oldEmail) {
          const { data: staffByOldEmail } = await supabase
            .from('STAFF')
            .select('staff_id, email, is_active, is_deleted')
            .eq('email', oldEmail)
            .single();

          if (staffByOldEmail) {
            // STAFFテーブルのemailを更新
            await supabase
              .from('STAFF')
              .update({ email: user.email })
              .eq('email', oldEmail);
            
            // メタデータをクリーンアップ
            await supabase.auth.updateUser({
              data: { old_email: null, pending_staff_id: null }
            });

            staff = { ...staffByOldEmail, email: user.email };
            console.log('Middleware: Synced STAFF email via old_email');
          }
        }
      }
    }

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

