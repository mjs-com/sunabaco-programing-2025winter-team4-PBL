'use server';

import { createClient } from '@/lib/supabase/server';
import type { StaffBasicInfo } from '@/types/database.types';

/**
 * アクティブなスタッフ一覧を取得（メンション用）
 * パフォーマンス最適化のため必要最小限のカラムのみ取得
 */
export async function getActiveStaff(): Promise<StaffBasicInfo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('STAFF')
    .select(`
      staff_id,
      name,
      job_type_id,
      personal_color,
      job_type:JOB_TYPE(
        job_type_id,
        job_name
      )
    `)
    .eq('is_active', true)
    .eq('is_hidden', false) // 非表示ユーザーを除外
    .eq('is_deleted', false) // 削除ユーザーを除外
    .order('name');

  if (error) {
    console.error('Error fetching staff:', error);
    return [];
  }

  // Supabaseは配列でjob_typeを返すため、最初の要素を取得
  return (data || []).map(staff => ({
    staff_id: staff.staff_id,
    name: staff.name,
    job_type_id: staff.job_type_id,
    personal_color: staff.personal_color,
    job_type: Array.isArray(staff.job_type) ? staff.job_type[0] : staff.job_type,
  }));
}

