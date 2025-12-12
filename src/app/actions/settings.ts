'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * 全てのカテゴリーを取得
 */
export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('CATEGORY')
    .select('*')
    .order('category_id', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data;
}

/**
 * カテゴリーの新規作成・更新
 */
export async function saveCategory(name: string, id?: number) {
  const supabase = await createClient();

  if (!name.trim()) {
    return { error: 'カテゴリー名を入力してください' };
  }

  if (id) {
    // 更新
    const { error } = await supabase
      .from('CATEGORY')
      .update({ category_name: name })
      .eq('category_id', id);

    if (error) return { error: error.message };
  } else {
    // 新規作成
    const { error } = await supabase
      .from('CATEGORY')
      .insert({ category_name: name, is_active: true });

    if (error) return { error: error.message };
  }

  revalidatePath('/settings/categories');
  return { success: true };
}

/**
 * カテゴリーの有効/無効切り替え
 */
export async function toggleCategoryStatus(id: number, isActive: boolean) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('CATEGORY')
    .update({ is_active: isActive })
    .eq('category_id', id);

  if (error) return { error: error.message };

  revalidatePath('/settings/categories');
  return { success: true };
}

/**
 * 全ての職種を取得
 */
export async function getJobTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('JOB_TYPE')
    .select('*')
    .order('job_type_id', { ascending: true });

  if (error) {
    console.error('Error fetching job types:', error);
    return [];
  }
  return data;
}

/**
 * 職種の新規作成・更新
 */
export async function saveJobType(name: string, id?: number) {
  const supabase = await createClient();

  if (!name.trim()) {
    return { error: '職種名を入力してください' };
  }

  if (id) {
    // 更新
    const { error } = await supabase
      .from('JOB_TYPE')
      .update({ job_name: name })
      .eq('job_type_id', id);

    if (error) return { error: error.message };
  } else {
    // 新規作成
    const { error } = await supabase
      .from('JOB_TYPE')
      .insert({ job_name: name, is_active: true });

    if (error) return { error: error.message };
  }

  revalidatePath('/settings/categories');
  return { success: true };
}

/**
 * 職種の有効/無効切り替え
 */
export async function toggleJobTypeStatus(id: number, isActive: boolean) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('JOB_TYPE')
    .update({ is_active: isActive })
    .eq('job_type_id', id);

  if (error) return { error: error.message };

  revalidatePath('/settings/categories');
  return { success: true };
}
