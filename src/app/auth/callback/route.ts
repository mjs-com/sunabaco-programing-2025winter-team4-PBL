import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  // "next" パラメータがあればそこへ、なければ承認待ちページへ
  const next = searchParams.get('next') ?? '/auth/pending';

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // パスワードリセット（recovery）の場合
  if (type === 'recovery' && token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash,
    });

    if (!error) {
      // パスワード再設定ページへ
      return NextResponse.redirect(`${origin}/auth/reset-password`);
    }
    
    return NextResponse.redirect(`${origin}/login?error=invalid_reset_link`);
  }

  // メールアドレス変更確認の場合（token_hash方式）
  if (type === 'email_change' && token_hash) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        type: 'email_change',
        token_hash,
      });

      if (!error && data.user) {
        // STAFFテーブルを同期
        await syncStaffEmail(supabase, data.user);
        return NextResponse.redirect(`${origin}/mypage?email_changed=true`);
      }
    } catch (e) {
      console.error('Error verifying email change OTP:', e);
    }
    
    return NextResponse.redirect(`${origin}/mypage?error=email_change_failed`);
  }

  // 通常の認証コードの場合（PKCE方式）
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // メール変更が完了している場合、STAFFテーブルを同期
      await syncStaffEmail(supabase, data.user);
      
      // 承認待ちページまたは指定先へリダイレクト
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // token_hashのみがある場合（Supabaseのデフォルトリダイレクト）
  if (token_hash && !type) {
    // セッションを取得してメール変更を検出
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await syncStaffEmail(supabase, user);
      return NextResponse.redirect(`${origin}/mypage?email_changed=true`);
    }
  }

  // エラー時またはコードがない場合はログインページへ
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

/**
 * Auth側のメールアドレスとSTAFFテーブルを同期
 */
async function syncStaffEmail(supabase: any, user: any) {
  const authEmail = user.email;
  const oldEmail = user.user_metadata?.old_email;
  const staffId = user.user_metadata?.pending_staff_id;

  if (!authEmail) return;

  // 方法1: user_metadataに保存されたstaff_idを使用
  if (staffId) {
    const { error } = await supabase
      .from('STAFF')
      .update({ email: authEmail })
      .eq('staff_id', staffId);
    
    if (!error) {
      // メタデータをクリーンアップ
      await supabase.auth.updateUser({
        data: { old_email: null, pending_staff_id: null }
      });
      return;
    }
  }

  // 方法2: 古いメールアドレスで検索
  if (oldEmail && oldEmail !== authEmail) {
    const { error } = await supabase
      .from('STAFF')
      .update({ email: authEmail })
      .eq('email', oldEmail);
    
    if (!error) {
      // メタデータをクリーンアップ
      await supabase.auth.updateUser({
        data: { old_email: null, pending_staff_id: null }
      });
      return;
    }
  }

  // 方法3: Auth側のemailでSTAFFが見つからない場合、不整合を検出
  const { data: existingStaff } = await supabase
    .from('STAFF')
    .select('staff_id, email')
    .eq('email', authEmail)
    .single();

  if (!existingStaff && oldEmail) {
    // Auth側のemailでSTAFFが見つからない = メール変更後にSTAFFが未更新
    await supabase
      .from('STAFF')
      .update({ email: authEmail })
      .eq('email', oldEmail);
  }
}
