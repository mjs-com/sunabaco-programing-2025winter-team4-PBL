'use server';

import { createClient } from '@/lib/supabase/server';
import type { StaffWithRelations } from '@/types/database.types';

/**
 * アクティブなスタッフ一覧を取得（メンション用）
 */
export async function getActiveStaff(): Promise<StaffWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('STAFF')
    .select(`
      staff_id,
      name,
      job_type_id,
      job_type:JOB_TYPE(
        job_type_id,
        job_name
      )
    `)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching staff:', error);
    return [];
  }

  return data as StaffWithRelations[];
}

