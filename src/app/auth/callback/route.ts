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

  // メールアドレス変更確認の場合
  if (type === 'email_change' && token_hash) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: 'email_change',
      token_hash,
    });

    if (!error && data.user) {
      const newEmail = data.user.email;
      const oldEmail = data.user.user_metadata?.old_email;
      const staffId = data.user.user_metadata?.pending_staff_id;

      // STAFFテーブルのemailを更新
      let updateSuccess = false;

      // 方法1: user_metadataに保存されたstaff_idを使用
      if (staffId) {
        const { error: staffError } = await supabase
          .from('STAFF')
          .update({ email: newEmail })
          .eq('staff_id', staffId);
        
        if (!staffError) {
          updateSuccess = true;
        }
      }

      // 方法2: 古いメールアドレスで検索
      if (!updateSuccess && oldEmail) {
        const { error: staffError } = await supabase
          .from('STAFF')
          .update({ email: newEmail })
          .eq('email', oldEmail);
        
        if (!staffError) {
          updateSuccess = true;
        }
      }

      // user_metadataをクリーンアップ
      await supabase.auth.updateUser({
        data: { 
          old_email: null,
          pending_staff_id: null
        }
      });

      if (updateSuccess) {
        return NextResponse.redirect(`${origin}/mypage?email_changed=true`);
      } else {
        // STAFF更新に失敗した場合でも、Auth側は更新されているので警告を表示
        return NextResponse.redirect(`${origin}/mypage?email_changed=partial`);
      }
    }
    
    return NextResponse.redirect(`${origin}/mypage?error=email_change_failed`);
  }

  // 通常の認証コードの場合
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // 承認待ちページへリダイレクト
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // エラー時またはコードがない場合はログインページへ
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
