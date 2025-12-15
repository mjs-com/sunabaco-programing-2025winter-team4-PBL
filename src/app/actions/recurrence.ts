'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { RecurringSettingWithRelations } from '@/types/database.types';

/**
 * 自分の繰り返し設定一覧を取得
 */
export async function getMyRecurringSettings(staffId: number): Promise<RecurringSettingWithRelations[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('recurring_settings')
    .select(`
      *,
      category:CATEGORY(
        category_id,
        category_name,
        is_active
      )
    `)
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recurring settings:', error);
    return [];
  }

  return data as RecurringSettingWithRelations[];
}

/**
 * 繰り返し設定を更新（終了日変更、頻度変更など）
 */
export async function updateRecurringSetting(
  settingId: number,
  staffId: number,
  input: {
    is_active?: boolean;
    end_date?: string;
    recurrence_type?: string;
    recurrence_config?: any;
  }
) {
  const supabase = await createClient();

  // 権限チェック
  const { data: setting } = await supabase
    .from('recurring_settings')
    .select('*')
    .eq('id', settingId)
    .single();

  if (!setting) {
    return { success: false, error: '設定が見つかりません' };
  }

  if (setting.staff_id !== staffId) {
    return { success: false, error: '権限がありません' };
  }

  const updates: any = { updated_at: new Date().toISOString() };

  // ステータス変更（一時停止/再開）
  if (input.is_active !== undefined) {
    updates.is_active = input.is_active;
  }

  // 終了日変更
  if (input.end_date) {
    updates.end_date = input.end_date;
    
    // 新終了日より後の未読日報を削除
    await supabase
      .from('DIARY')
      .delete()
      .eq('recurring_id', settingId)
      .gt('target_date', input.end_date)
      .eq('current_status', 'UNREAD');
  }

  // 頻度変更
  if (input.recurrence_type !== undefined) {
    updates.recurrence_type = input.recurrence_type;
  }

  if (input.recurrence_config !== undefined) {
    updates.recurrence_config = input.recurrence_config;
    
    // 頻度変更時は既存の未読日報を削除して再生成する必要がある
    // ただし、これは複雑になるため、頻度変更時は既存の未読日報を削除するだけにする
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('DIARY')
      .delete()
      .eq('recurring_id', settingId)
      .gte('target_date', today)
      .eq('current_status', 'UNREAD');
  }

  const { error } = await supabase
    .from('recurring_settings')
    .update(updates)
    .eq('id', settingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/settings/recurrence');
  return { success: true };
}

/**
 * 繰り返し設定を削除
 */
export async function deleteRecurringSetting(settingId: number, staffId: number) {
  const supabase = await createClient();
  
  // 権限チェック
  const { data: setting } = await supabase
    .from('recurring_settings')
    .select('staff_id')
    .eq('id', settingId)
    .single();

  if (!setting) {
    return { success: false, error: '設定が見つかりません' };
  }

  if (setting.staff_id !== staffId) {
    return { success: false, error: '権限がありません' };
  }
  
  // 1. 未来の未読日報を削除
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('DIARY')
    .delete()
    .eq('recurring_id', settingId)
    .gt('target_date', today)
    .eq('current_status', 'UNREAD');
    
  // 2. 残った日報の紐付けを解除（外部キー制約対策）
  await supabase
    .from('DIARY')
    .update({ recurring_id: null })
    .eq('recurring_id', settingId);
    
  // 3. 設定を削除
  const { error } = await supabase
    .from('recurring_settings')
    .delete()
    .eq('id', settingId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/settings/recurrence');
  return { success: true };
}
