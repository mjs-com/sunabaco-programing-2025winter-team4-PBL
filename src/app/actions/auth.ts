'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

/**
 * メール/パスワードでログイン
 */
export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * ログアウト
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * 新規ユーザー登録（開発用・管理者用）
 */
export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const origin = headers().get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, message: '確認メールを送信しました' };
}

/**
 * パスワードリセットメールを送信
 */
export async function resetPassword(email: string) {
  const supabase = await createClient();
  const origin = headers().get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // メールアドレスが登録されているか確認
  const { data: staff } = await supabase
    .from('STAFF')
    .select('email')
    .eq('email', email)
    .eq('is_deleted', false)
    .single();

  if (!staff) {
    // セキュリティのため、存在しない場合も同じメッセージを返す
    return { success: true, message: 'メールアドレスが登録されている場合、リセットメールを送信しました' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    console.error('Error sending reset password email:', error);
    return { error: 'リセットメールの送信に失敗しました。しばらく経ってからお試しください。' };
  }

  return { success: true, message: 'パスワードリセットメールを送信しました。メールをご確認ください。' };
}

/**
 * パスワードを更新（リセット後）
 */
export async function updatePasswordAfterReset(newPassword: string) {
  const supabase = await createClient();

  if (newPassword.length < 6) {
    return { error: 'パスワードは6文字以上で入力してください' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('Error updating password:', error);
    return { error: 'パスワードの更新に失敗しました' };
  }

  return { success: true };
}

/**
 * スタッフ新規登録申請
 */
export async function registerStaff(formData: FormData) {
  const supabase = await createClient();
  const origin = headers().get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const job_type_id = parseInt(formData.get('job_type_id') as string);

  // バリデーション
  if (!name || !email || !password || !job_type_id) {
    return { error: 'すべての項目を入力してください' };
  }

  if (password.length < 6) {
    return { error: 'パスワードは6文字以上で入力してください' };
  }

  // 既存のメールアドレスチェック
  const { data: existingStaff } = await supabase
    .from('STAFF')
    .select('email')
    .eq('email', email)
    .single();

  if (existingStaff) {
    return { error: 'このメールアドレスは既に登録されています' };
  }

  // Supabase Authにユーザーを作成
  // emailRedirectToを明示的に指定することで、環境に応じた正しいリダイレクト先を設定
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'ユーザー作成に失敗しました' };
  }

  // login_idを生成（メールアドレスの@より前の部分）
  const login_id = email.split('@')[0];

  // STAFFテーブルに登録（承認待ち状態: is_active = false）
  const { error: staffError } = await supabase
    .from('STAFF')
    .insert({
      name,
      login_id,
      password_hash: 'dummy_hash', // 実際の認証はSupabase Authを使用
      email,
      job_type_id,
      system_role_id: 2, // 一般ユーザー
      is_active: false, // 承認待ち
      current_points: 0,
    });

  if (staffError) {
    // STAFF登録に失敗した場合、エラーメッセージを返す
    // 注意: Authユーザーの削除には管理者権限が必要なため、ここでは削除しない
    return { error: `スタッフ登録に失敗しました: ${staffError.message}` };
  }

  return { success: true };
}
