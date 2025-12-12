'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
 * 本人がプロフィールを更新
 */
export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createClient();

  // スタッフ情報の更新
  const updateData: { name?: string; email?: string; personal_color?: string | null } = {};
  if (input.name) updateData.name = input.name;
  if (input.email) updateData.email = input.email;
  if (input.personal_color !== undefined) updateData.personal_color = input.personal_color;

  const { error: staffError } = await supabase
    .from('STAFF')
    .update(updateData)
    .eq('staff_id', input.staff_id);

  if (staffError) {
    console.error('Error updating staff:', staffError);
    return { success: false, error: staffError.message };
  }

  // メールアドレスが変更された場合、Supabase Authも更新
  if (input.email) {
    const { error: authError } = await supabase.auth.updateUser({
      email: input.email,
    });

    if (authError) {
      console.error('Error updating auth email:', authError);
      // スタッフテーブルは更新されたが、Auth更新に失敗した場合の警告
      return { 
        success: true, 
        warning: 'プロフィールは更新されましたが、認証メールの更新に失敗しました。再度ログインしてください。' 
      };
    }
  }

  revalidatePath('/mypage');
  revalidatePath('/cleaning-duty/calendar');
  return { success: true };
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

