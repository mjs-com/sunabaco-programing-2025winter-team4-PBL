'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

interface UpdateProfileInput {
  staff_id: number;
  name?: string;
  email?: string;
  personal_color?: string | null;
}

interface UpdatePasswordInput {
  newPassword: string;
}

interface UpdateStaffByAdminInput {
  staff_id: number;
  job_type_id?: number;
  system_role_id?: number;
}

/**
 * 本人がプロフィールを更新（名前のみ）
 */
export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createClient();

  // 名前のみSTAFFテーブルを更新（メールアドレスは別関数で処理）
  const updateData: { name?: string; personal_color?: string | null } = {};
  if (input.name) updateData.name = input.name;
  if (input.personal_color !== undefined) updateData.personal_color = input.personal_color;

  if (Object.keys(updateData).length > 0) {
    const { error: staffError } = await supabase
      .from('STAFF')
      .update(updateData)
      .eq('staff_id', input.staff_id);

    if (staffError) {
      console.error('Error updating staff:', staffError);
      return { success: false, error: staffError.message };
    }
  }

  revalidatePath('/mypage');
  revalidatePath('/cleaning-duty/calendar');
  return { success: true };
}

/**
 * メールアドレス変更リクエスト
 * Supabase Auth側のみ更新し、確認メールを送信
 * STAFFテーブルは確認完了後（auth/callback）で更新
 */
export async function requestEmailChange(staffId: number, newEmail: string) {
  const supabase = await createClient();
  const origin = headers().get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // 現在のユーザー情報を取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '認証されていません' };
  }

  // 新しいメールアドレスが既に使用されていないかチェック
  const { data: existingStaff } = await supabase
    .from('STAFF')
    .select('staff_id')
    .eq('email', newEmail)
    .neq('staff_id', staffId)
    .single();

  if (existingStaff) {
    return { success: false, error: 'このメールアドレスは既に使用されています' };
  }

  // 古いメールアドレスをuser_metadataに保存（確認完了時にSTAFF更新に使用）
  const { error: metaError } = await supabase.auth.updateUser({
    data: { 
      old_email: user.email,
      pending_staff_id: staffId
    }
  });

  if (metaError) {
    console.error('Error saving old email to metadata:', metaError);
  }

  // Supabase Authにメールアドレス変更をリクエスト
  const { error: authError } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (authError) {
    console.error('Error requesting email change:', authError);
    return { success: false, error: authError.message };
  }

  return { 
    success: true, 
    emailChangeRequested: true,
    message: '確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。'
  };
}

/**
 * パーソナルカラーのみを更新
 */
export async function updatePersonalColor(staffId: number, color: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('STAFF')
    .update({ personal_color: color })
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error updating personal color:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/mypage');
  revalidatePath('/cleaning-duty/calendar');
  return { success: true };
}

/**
 * パスワードを変更
 */
export async function updatePassword(input: UpdatePasswordInput) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (error) {
    console.error('Error updating password:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 管理者がスタッフ情報を更新（職種・役割）
 */
export async function updateStaffByAdmin(
  currentUserId: number,
  input: UpdateStaffByAdminInput
) {
  const supabase = await createClient();

  // 現在のユーザーが管理者かチェック
  const { data: currentUser, error: userError } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('staff_id', currentUserId)
    .single();

  if (userError || currentUser?.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // 更新データを構築
  const updateData: { job_type_id?: number; system_role_id?: number } = {};
  if (input.job_type_id !== undefined) updateData.job_type_id = input.job_type_id;
  if (input.system_role_id !== undefined) updateData.system_role_id = input.system_role_id;

  const { error: updateError } = await supabase
    .from('STAFF')
    .update(updateData)
    .eq('staff_id', input.staff_id);

  if (updateError) {
    console.error('Error updating staff by admin:', updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath('/mypage');
  revalidatePath('/admin');
  return { success: true };
}

/**
 * 職種一覧を取得
 */
export async function getJobTypesForProfile() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('JOB_TYPE')
    .select('*')
    .order('job_type_id');

  if (error) {
    console.error('Error fetching job types:', error);
    return [];
  }

  return data || [];
}

/**
 * システムロール一覧を取得
 */
export async function getSystemRoles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('SYSTEM_ROLE')
    .select('*')
    .order('system_role_id');

  if (error) {
    console.error('Error fetching system roles:', error);
    return [];
  }

  return data || [];
}

