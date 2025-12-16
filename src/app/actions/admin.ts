'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { StaffWithRelations } from '@/types/database.types';

/**
 * 承認待ちスタッフ一覧を取得
 */
export async function getPendingStaff() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('STAFF')
    .select(`
      *,
      job_type:JOB_TYPE(*)
    `)
    .eq('is_active', false)
    .eq('is_deleted', false) // 削除されていないユーザーのみ
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending staff:', error);
    return [];
  }

  return data;
}

/**
 * スタッフを承認
 */
export async function approveStaff(staffId: number) {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // スタッフを承認（is_active = true）
  const { error } = await supabase
    .from('STAFF')
    .update({ is_active: true })
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error approving staff:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  return { success: true };
}

/**
 * ユーザー管理画面用：全スタッフ一覧を取得（削除されていないもののみ）
 * is_deleted=falseのスタッフを取得（非表示ユーザーも含む）
 */
export async function getAllStaffForManagement(): Promise<StaffWithRelations[]> {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return [];
  }

  const { data, error } = await supabase
    .from('STAFF')
    .select(`
      *,
      job_type:JOB_TYPE(*),
      system_role:SYSTEM_ROLE(*)
    `)
    .eq('is_deleted', false) // 削除されていないユーザーのみ
    .order('is_hidden', { ascending: true }) // 非表示ユーザーを後ろに
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching staff for management:', error);
    return [];
  }

  return data || [];
}

/**
 * 削除済みスタッフ一覧を取得（復元用）
 * 完全削除されたユーザーは除外（中間テーブルで管理）
 */
export async function getDeletedStaff(): Promise<StaffWithRelations[]> {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return [];
  }

  // 完全削除されたスタッフIDを取得
  const { data: permanentlyDeleted } = await supabase
    .from('permanently_deleted_staff')
    .select('staff_id');
  
  const permanentlyDeletedIds = (permanentlyDeleted || []).map(p => p.staff_id);

  // 削除済み（is_deleted=true）で、完全削除されていないスタッフを取得
  let query = supabase
    .from('STAFF')
    .select(`
      *,
      job_type:JOB_TYPE(*),
      system_role:SYSTEM_ROLE(*)
    `)
    .eq('is_deleted', true); // 削除済みユーザーのみ

  // 完全削除されたスタッフを除外
  if (permanentlyDeletedIds.length > 0) {
    query = query.not('staff_id', 'in', `(${permanentlyDeletedIds.join(',')})`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted staff:', error);
    return [];
  }

  return data || [];
}

/**
 * スタッフの非表示フラグを切り替え
 */
export async function toggleStaffHidden(staffId: number, isHidden: boolean) {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // 非表示フラグを更新
  const { error } = await supabase
    .from('STAFF')
    .update({ 
      is_hidden: isHidden,
      updated_at: new Date().toISOString()
    })
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error toggling staff hidden:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * スタッフの削除フラグを切り替え（論理削除/復元）
 * 
 * 一般的なサブスクリプション型サービスと同様のパターン:
 * - 削除: is_deleted = true にするだけ（メールアドレスは変更しない）
 * - 復元: is_deleted = false に戻すだけ
 * - ユーザーは同じアカウントで再入会可能
 */
export async function toggleStaffDeleted(staffId: number, isDeleted: boolean) {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // 削除する場合のみ、最後の管理者チェックを行う
  if (isDeleted) {
    const { data: targetStaff } = await supabase
      .from('STAFF')
      .select('system_role_id')
      .eq('staff_id', staffId)
      .single();

    if (targetStaff && targetStaff.system_role_id === 1) {
      const { data: otherAdmins, error: countError } = await supabase
        .from('STAFF')
        .select('staff_id')
        .eq('system_role_id', 1)
        .eq('is_deleted', false)
        .neq('staff_id', staffId);

      if (countError) {
        console.error('Error checking admin count:', countError);
        return { success: false, error: '管理者数の確認に失敗しました' };
      }

      if (!otherAdmins || otherAdmins.length === 0) {
        return { success: false, error: '最後の管理者は削除できません' };
      }
    }
  }

  // 削除フラグを更新（シンプルにフラグを切り替えるだけ）
  const { error } = await supabase
    .from('STAFF')
    .update({ 
      is_deleted: isDeleted,
      updated_at: new Date().toISOString()
    })
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error toggling staff deleted:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * スタッフを完全削除（画面から非表示にする）
 * 中間テーブルにレコードを追加し、管理画面から見えなくする
 * データベースには残る（物理削除しない）
 */
export async function permanentlyDeleteStaff(staffId: number) {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // 対象ユーザーが削除済み状態かチェック
  const { data: targetStaff } = await supabase
    .from('STAFF')
    .select('is_deleted')
    .eq('staff_id', staffId)
    .single();

  if (!targetStaff || !targetStaff.is_deleted) {
    return { success: false, error: '削除済みユーザーのみ完全削除できます' };
  }

  // 中間テーブルにレコードを挿入（完全削除として記録）
  const { error } = await supabase
    .from('permanently_deleted_staff')
    .insert({ staff_id: staffId });

  if (error) {
    console.error('Error permanently deleting staff:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * スタッフの管理者権限を切り替え
 */
export async function toggleStaffAdminRole(staffId: number, isAdmin: boolean) {
  const supabase = await createClient();

  // 管理者権限チェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { data: currentStaff } = await supabase
    .from('STAFF')
    .select('system_role_id')
    .eq('email', user.email)
    .single();

  if (!currentStaff || currentStaff.system_role_id !== 1) {
    return { success: false, error: '管理者権限が必要です' };
  }

  // 管理者権限をOFFにする場合、最後の管理者をOFFにしようとしていないかチェック
  if (!isAdmin) {
    const { data: targetStaff } = await supabase
      .from('STAFF')
      .select('system_role_id')
      .eq('staff_id', staffId)
      .single();

    if (targetStaff && targetStaff.system_role_id === 1) {
      const { data: otherAdmins, error: countError } = await supabase
        .from('STAFF')
        .select('staff_id')
        .eq('system_role_id', 1)
        .eq('is_deleted', false)
        .neq('staff_id', staffId);

      if (countError) {
        console.error('Error checking admin count:', countError);
        return { success: false, error: '管理者数の確認に失敗しました' };
      }

      if (!otherAdmins || otherAdmins.length === 0) {
        return { success: false, error: '最後の管理者の権限をOFFにすることはできません' };
      }
    }
  }

  // 管理者権限を更新（1=管理者、2=一般ユーザー）
  const newRoleId = isAdmin ? 1 : 2;
  const { error } = await supabase
    .from('STAFF')
    .update({ 
      system_role_id: newRoleId,
      updated_at: new Date().toISOString()
    })
    .eq('staff_id', staffId);

  if (error) {
    console.error('Error toggling staff admin role:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}
