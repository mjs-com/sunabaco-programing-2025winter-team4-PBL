'use server';

import { createClient } from '@/lib/supabase/server';
import { toISODateString } from '@/lib/utils';
import { getCurrentStaff } from '@/app/actions/diary';
import type { DiaryWithRelations } from '@/types/database.types';

export type CleaningDutyAssignment = {
  duty_date: string; // YYYY-MM-DD
  staff_id: number;
};

const DIARY_SELECT_WITH_RELATIONS = `
  *,
  category:CATEGORY(*),
  staff:STAFF!DIARY_staff_id_fkey(*, job_type:JOB_TYPE(*)),
  updated_by_staff:STAFF!DIARY_updated_by_fkey(*),
  solved_by_staff:STAFF!DIARY_solved_by_fkey(*),
  user_statuses:USER_DIARY_STATUS(
    *,
    staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(*, job_type:JOB_TYPE(*))
  ),
  replies:DIARY!parent_id(
    *,
    staff:STAFF!DIARY_staff_id_fkey(*, job_type:JOB_TYPE(*)),
    user_statuses:USER_DIARY_STATUS(*, staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(*))
  )
`;

function parseISODate(dateString: string): Date {
  // サーバー/クライアントのローカルTZに依存しないよう「日付だけ」を固定
  return new Date(`${dateString}T00:00:00`);
}

function addDaysISO(dateString: string, days: number): string {
  const d = parseISODate(dateString);
  d.setDate(d.getDate() + days);
  return toISODateString(d);
}

async function getCleaningDutyCategoryId(): Promise<number | null> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('CATEGORY')
    .select('category_id')
    .eq('category_name', '掃除当番')
    .maybeSingle();

  if (existingError) {
    console.error('Error fetching cleaning duty category:', existingError);
  }

  if (existing?.category_id) return existing.category_id;

  // ない場合は作成を試みる（RLS等で失敗する可能性があるのでフォールバックあり）
  const { data: created, error: createError } = await supabase
    .from('CATEGORY')
    .insert({ category_name: '掃除当番', is_active: true })
    .select('category_id')
    .single();

  if (!createError && created?.category_id) return created.category_id;

  if (createError) {
    console.error('Error creating cleaning duty category (fallback to first active):', createError);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('CATEGORY')
    .select('category_id')
    .eq('is_active', true)
    .order('category_id')
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.error('Error fetching fallback category:', fallbackError);
    return null;
  }

  return fallback?.category_id ?? null;
}

async function fetchDiaryById(diaryId: number): Promise<DiaryWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('DIARY')
    .select(DIARY_SELECT_WITH_RELATIONS)
    .eq('diary_id', diaryId)
    .single();

  if (error) {
    console.error('Error fetching diary by id:', error);
    return null;
  }

  return data as DiaryWithRelations;
}

/**
 * 指定日の掃除当番（staff_id）を取得
 * ※ CLEANING_DUTY_ASSIGNMENT テーブルが存在しない場合は null を返す
 */
export async function getCleaningDutyAssigneeId(dutyDate: string): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('CLEANING_DUTY_ASSIGNMENT')
    .select('staff_id')
    .eq('duty_date', dutyDate)
    .maybeSingle();

  if (error) {
    // テーブルが存在しない場合（42P01）やカラムがない場合（42703）は警告のみ
    const errCode = (error as any).code;
    if (errCode === '42P01' || errCode === '42703') {
      console.warn('CLEANING_DUTY_ASSIGNMENT table or columns not found. Cleaning duty feature disabled.');
      return null;
    }
    console.error('Error fetching cleaning duty assignee:', error);
    return null;
  }

  return data?.staff_id ?? null;
}

/**
 * 指定範囲の掃除当番一覧を取得
 */
export async function getCleaningDutyAssignmentsByRange(
  startDate: string,
  endDate: string
): Promise<CleaningDutyAssignment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('CLEANING_DUTY_ASSIGNMENT')
    .select('duty_date, staff_id')
    .gte('duty_date', startDate)
    .lte('duty_date', endDate)
    .order('duty_date');

  if (error) {
    console.error('Error fetching cleaning duty assignments:', error);
    return [];
  }

  return (data || []) as CleaningDutyAssignment[];
}

/**
 * 掃除当番を「繰り返し」で登録（指定曜日のみ）
 * - staffId=0 の場合は該当日を削除（担当者なし）
 * - duty_dateは既存と衝突したら上書き
 * - 一般ユーザーも編集可能
 */
export async function upsertCleaningDutyAssignments(params: {
  staffId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weekDays: number[]; // 0=日 ... 6=土
}) {
  const currentStaff = await getCurrentStaff();
  if (!currentStaff) return { success: false, error: 'ログインが必要です' };

  const { staffId, startDate, endDate, weekDays } = params;

  if (!startDate || !endDate) {
    return { success: false, error: '入力が不足しています' };
  }

  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: '日付の形式が正しくありません' };
  }
  if (start > end) {
    return { success: false, error: '開始日は終了日より前にしてください' };
  }

  const normalizedWeekDays = Array.from(new Set(weekDays)).filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6
  );
  if (normalizedWeekDays.length === 0) {
    return { success: false, error: '曜日を1つ以上選択してください' };
  }

  // 対象日付を列挙
  const targetDates: string[] = [];
  let cursor = startDate;
  while (parseISODate(cursor) <= end) {
    const d = parseISODate(cursor);
    if (normalizedWeekDays.includes(d.getDay())) {
      targetDates.push(cursor);
    }
    cursor = addDaysISO(cursor, 1);
  }

  const supabase = await createClient();

  // staffId=0 の場合は削除
  if (!staffId) {
    const { error } = await supabase
      .from('CLEANING_DUTY_ASSIGNMENT')
      .delete()
      .in('duty_date', targetDates);

    if (error) {
      console.error('Error deleting cleaning duty assignments:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  // staffIdが指定されている場合はupsert
  const rows = targetDates.map((dutyDate) => ({
    duty_date: dutyDate,
    staff_id: staffId,
    updated_by: currentStaff.staff_id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('CLEANING_DUTY_ASSIGNMENT')
    .upsert(rows, { onConflict: 'duty_date' });

  if (error) {
    console.error('Error upserting cleaning duty assignments:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 特定日の掃除当番を設定（単日）
 * - 一般ユーザーも編集可能
 */
export async function setCleaningDutyAssignmentForDate(dutyDate: string, staffId: number) {
  const currentStaff = await getCurrentStaff();
  if (!currentStaff) return { success: false, error: 'ログインが必要です' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('CLEANING_DUTY_ASSIGNMENT')
    .upsert(
      {
        duty_date: dutyDate,
        staff_id: staffId,
        updated_by: currentStaff.staff_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'duty_date' }
    );

  if (error) {
    console.error('Error setting cleaning duty assignment for date:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 特定日の掃除当番を解除（単日）
 * - 一般ユーザーも編集可能
 */
export async function deleteCleaningDutyAssignmentForDate(dutyDate: string) {
  const currentStaff = await getCurrentStaff();
  if (!currentStaff) return { success: false, error: 'ログインが必要です' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('CLEANING_DUTY_ASSIGNMENT')
    .delete()
    .eq('duty_date', dutyDate);

  if (error) {
    console.error('Error deleting cleaning duty assignment:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 掃除当番用のDIARY（該当日ぶん）を取得。なければ作成。
 * - 1日につき1件（target_date×diary_type）
 * - target_staff_idは「当番のstaff_id」になる
 * 
 * ※ DBに diary_type / target_staff_id カラムが未導入の場合は null を返す
 */
export async function getOrCreateCleaningDutyDiary(dutyDate: string): Promise<DiaryWithRelations | null> {
  const assigneeId = await getCleaningDutyAssigneeId(dutyDate);
  if (!assigneeId) return null;

  const supabase = await createClient();

  // 既存（当番が変更されても同一レコードを更新して使い回す）
  const { data: existing, error: existingError } = await supabase
    .from('DIARY')
    .select(DIARY_SELECT_WITH_RELATIONS)
    .eq('target_date', dutyDate)
    .eq('diary_type', 'CLEANING_DUTY')
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .is('parent_id', null)
    .maybeSingle();

  // diary_type カラムが存在しない場合（マイグレーション未適用）は null を返す
  if (existingError) {
    const errCode = (existingError as any).code;
    const errMsg = String((existingError as any).message || '');
    if (errCode === '42703' && (errMsg.includes('diary_type') || errMsg.includes('target_staff_id'))) {
      console.warn('Cleaning duty columns (diary_type / target_staff_id) not found in DIARY table. Skipping cleaning duty feature.');
      return null;
    }
    console.error('Error fetching existing cleaning duty diary:', existingError);
    return null;
  }

  if (existing) {
    const currentTarget = (existing as any).target_staff_id as number | null | undefined;
    if (currentTarget !== assigneeId) {
      const { error: updateError } = await supabase
        .from('DIARY')
        .update({
          target_staff_id: assigneeId,
          updated_at: new Date().toISOString(),
        })
        .eq('diary_id', (existing as any).diary_id);

      if (updateError) {
        console.error('Error updating cleaning duty diary target_staff_id:', updateError);
      } else {
        const refetched = await fetchDiaryById((existing as any).diary_id);
        return refetched;
      }
    }

    return existing as DiaryWithRelations;
  }

  const categoryId = await getCleaningDutyCategoryId();
  if (!categoryId) {
    console.error('Cleaning duty category id not found; cannot create diary');
    return null;
  }

  // 当番者の名前を取得してメンションに使用
  const { data: assignee } = await supabase
    .from('STAFF')
    .select('name')
    .eq('staff_id', assigneeId)
    .single();
  
  const assigneeName = assignee?.name || '';
  const mentionText = assigneeName ? `@${assigneeName} ` : '';

  const { data: created, error: createError } = await supabase
    .from('DIARY')
    .insert({
      category_id: categoryId,
      staff_id: assigneeId,
      title: '本日の掃除当番はあなたです',
      content: `${mentionText}本日の掃除当番です。完了したら「解決済み」を押してください。`,
      target_date: dutyDate,
      is_urgent: false,
      bounty_points: null,
      is_hidden: false,
      is_deleted: false,
      current_status: 'UNREAD',
      parent_id: null,
      diary_type: 'CLEANING_DUTY',
      target_staff_id: assigneeId,
    })
    .select('diary_id')
    .single();

  if (createError) {
    // カラムが存在しない場合も握りつぶす
    const errCode = (createError as any).code;
    const errMsg = String((createError as any).message || '');
    if (errCode === '42703' && (errMsg.includes('diary_type') || errMsg.includes('target_staff_id'))) {
      console.warn('Cleaning duty columns not found. Skipping.');
      return null;
    }
    console.error('Error creating cleaning duty diary:', createError);
    return null;
  }

  return await fetchDiaryById(created.diary_id);
}

/**
 * 自分が当番の日のみ、掃除当番DIARYを返す（当番でなければnull）
 */
export async function getCleaningDutyDiaryForStaff(dutyDate: string, staffId: number): Promise<DiaryWithRelations | null> {
  const assigneeId = await getCleaningDutyAssigneeId(dutyDate);
  if (!assigneeId) return null;
  if (assigneeId !== staffId) return null;

  return await getOrCreateCleaningDutyDiary(dutyDate);
}

