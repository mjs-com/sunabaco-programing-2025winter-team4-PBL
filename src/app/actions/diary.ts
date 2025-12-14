'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  DiaryWithRelations,
  CreateDiaryInput,
  UserStatus,
  Category,
  POINT_CONFIG,
} from '@/types/database.types';

// ポイント設定
const POINTS = {
  CONFIRM: 1,
  WORKING: 5,
  SOLVED: 10,
  REPLY: 3,
  POST_DIARY: 2,
} as const;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 指定日の日報一覧を取得
 */
export async function getDiariesByDate(
  targetDate: string,
  filter?: 'urgent' | 'todo' | null,
  currentStaffId?: number,
  currentStaffJobType?: string,
  currentStaffName?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<DiaryWithRelations[]> {
  const supabase = await createClient();

  // 基本クエリ（日付やフィルタ条件は後で追加）
  let query = supabase
    .from('DIARY')
    .select(`
      *,
      category:CATEGORY(
        category_id,
        category_name,
        is_active
      ),
      staff:STAFF!DIARY_staff_id_fkey(
        staff_id,
        name,
        job_type_id,
        job_type:JOB_TYPE(
          job_type_id,
          job_name
        )
      ),
      updated_by_staff:STAFF!DIARY_updated_by_fkey(
        staff_id,
        name
      ),
      solved_by_staff:STAFF!DIARY_solved_by_fkey(
        staff_id,
        name
      ),
      user_statuses:USER_DIARY_STATUS(
        id,
        diary_id,
        staff_id,
        status,
        updated_at,
        staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(
          staff_id,
          name,
          job_type_id,
          job_type:JOB_TYPE(
            job_type_id,
            job_name
          )
        )
      ),
      replies:DIARY!parent_id(
        *,
        staff:STAFF!DIARY_staff_id_fkey(
          staff_id,
          name,
          job_type_id,
          job_type:JOB_TYPE(
            job_type_id,
            job_name
          )
        ),
        user_statuses:USER_DIARY_STATUS(
          id,
          diary_id,
          staff_id,
          status,
          updated_at,
          staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(
            staff_id,
            name,
            job_type_id,
            job_type:JOB_TYPE(
              job_type_id,
              job_name
            )
          )
        )
      )
    `)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .is('parent_id', null);

  // フィルタ条件の適用
  if (filter === 'todo' || filter === 'urgent') {
    // TODOまたは至急の場合は、未解決のみを表示（日付指定なし＝過去分も含む）
    query = query.neq('current_status', 'SOLVED');

    if (filter === 'urgent') {
      query = query.eq('is_urgent', true);
    }
    // note: 'todo' の場合のメンション判定は複雑なため、データ取得後にJS側で行う
  } else {
    // 通常表示の場合は日付で絞り込み
    query = query.eq('target_date', targetDate);
  }

  // 宛先フィルタ用関数（ターゲット絞り込みの有無で使い分けるため分離）
  const applyTargetFilter = (q: any, includeTargetFilter: boolean) => {
    let internalQuery = q;
    
    // 宛先（target_staff_id）がある日報は、そのスタッフのみに表示
    if (includeTargetFilter) {
      if (currentStaffId) {
        internalQuery = internalQuery.or(`target_staff_id.is.null,target_staff_id.eq.${currentStaffId}`);
      } else {
        internalQuery = internalQuery.is('target_staff_id', null);
      }
    }
    
    return internalQuery;
  };

  // データを取得（target_staff_idカラムが存在しない場合のフォールバック付き）
  let data: DiaryWithRelations[] | null = null;
  let error: any = null;

  // 1. target_staff_idフィルタありで試行
  // ソート順は指定に従う（デフォルトは作成日）
  const orderDirection = sortOrder === 'asc' ? true : false;
  
  // クエリの複製はできないため、ここでクエリを実行
  // order指定: 期限があるものは期限順、ないものは作成日順などのロジックはJS側でやるため、
  // ここではとりあえず作成日順で取得しておく
  const queryWithTarget = applyTargetFilter(query, true).order('created_at', { ascending: orderDirection });
  
  const result1 = await queryWithTarget;
  
  if (result1.error) {
    // エラーが target_staff_id 関連なら、フィルタなしで再試行
    if ((result1.error as any).code === '42703' && String((result1.error as any).message || '').includes('target_staff_id')) {
      const queryWithoutTarget = applyTargetFilter(query, false).order('created_at', { ascending: orderDirection });
      const result2 = await queryWithoutTarget;
      data = result2.data as DiaryWithRelations[];
      error = result2.error;
    } else {
      error = result1.error;
    }
  } else {
    data = result1.data as DiaryWithRelations[];
  }

  if (error) {
    console.error('Error fetching diaries:', error);
    return [];
  }

  let diaries = data || [];

  // TODOフィルター（自分宛てのみ表示）
  if (filter === 'todo' && currentStaffId) {
    diaries = diaries.filter(diary => {
      // 未解決のみ (DBで絞っているが念のため)
      if (diary.current_status === 'SOLVED') return false;
      
      // メンション判定
      const content = diary.content || '';
      const isMentionedAll = content.includes('@All');
      const isMentionedJobType = currentStaffJobType && content.includes(`@${currentStaffJobType}`);
      const isMentionedName = currentStaffName && content.includes(`@${currentStaffName}`);
      
      return isMentionedAll || isMentionedJobType || isMentionedName;
    });
  }

  // 返信を日付順にソート
  diaries.forEach(diary => {
    if (diary.replies) {
      diary.replies.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  });

  // 並び替え: 
  // ユーザー指定の並び順 (asc/desc) に従う
  diaries.sort((a, b) => {
    // 通常表示の場合の既存ロジック（未解決上、解決済み下など）は、
    // ユーザーが明示的にソートを指定していない場合（filterなし、sortなし）に適用すべきかもしれないが、
    // 今回の改修ではfilterがある場合の挙動がメイン。
    
    // filterがない場合（通常の日付表示）は、既存の「未解決優先」などのロジックを残すべきか？
    // 要望には「トップページのtodoを押すと...」「至急ボタンについても...」とあるので、
    // 通常表示（特定の日付表示）については言及されていない。
    // しかし、getDiariesByDateは共通で使われている。
    
    if (!filter) {
        // 既存のロジック（未解決優先など）を維持したい場合
        // 解決済みは下に
        if (a.current_status === 'SOLVED' && b.current_status !== 'SOLVED') return 1;
        if (a.current_status !== 'SOLVED' && b.current_status === 'SOLVED') return -1;
        
        // 両方とも未解決の場合、期限でソート
        if (a.current_status !== 'SOLVED' && b.current_status !== 'SOLVED') {
          if (a.deadline && b.deadline) {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          }
          if (a.deadline && !b.deadline) return -1;
          if (!a.deadline && b.deadline) return 1;
        }
        // 期限がない場合は作成日順（新しい順 = desc）
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    
    // filterがある場合（TODO/Urgent）は単純な日付ソート
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    
    if (sortOrder === 'asc') {
      return timeA - timeB;
    } else {
      return timeB - timeA;
    }
  });

  return diaries;
}

/**
 * すべての未解決日報を取得
 */
export async function getAllUnsolvedDiaries(
  currentStaffId?: number
): Promise<DiaryWithRelations[]> {
  const supabase = await createClient();

  // 基本クエリ（未解決のみ、削除・非表示を除く）
  let query = supabase
    .from('DIARY')
    .select(`
      *,
      category:CATEGORY(
        category_id,
        category_name,
        is_active
      ),
      staff:STAFF!DIARY_staff_id_fkey(
        staff_id,
        name,
        job_type_id,
        job_type:JOB_TYPE(
          job_type_id,
          job_name
        )
      ),
      updated_by_staff:STAFF!DIARY_updated_by_fkey(
        staff_id,
        name
      ),
      solved_by_staff:STAFF!DIARY_solved_by_fkey(
        staff_id,
        name
      ),
      user_statuses:USER_DIARY_STATUS(
        id,
        diary_id,
        staff_id,
        status,
        updated_at,
        staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(
          staff_id,
          name,
          job_type_id,
          job_type:JOB_TYPE(
            job_type_id,
            job_name
          )
        )
      ),
      replies:DIARY!parent_id(
        *,
        staff:STAFF!DIARY_staff_id_fkey(
          staff_id,
          name,
          job_type_id,
          job_type:JOB_TYPE(
            job_type_id,
            job_name
          )
        ),
        user_statuses:USER_DIARY_STATUS(
          id,
          diary_id,
          staff_id,
          status,
          updated_at,
          staff:STAFF!USER_DIARY_STATUS_staff_id_fkey(
            staff_id,
            name,
            job_type_id,
            job_type:JOB_TYPE(
              job_type_id,
              job_name
            )
          )
        )
      )
    `)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .is('parent_id', null)
    .neq('current_status', 'SOLVED');

  // 宛先フィルタ用関数（ターゲット絞り込みの有無で使い分けるため分離）
  const applyTargetFilter = (q: any, includeTargetFilter: boolean) => {
    let internalQuery = q;
    
    // 宛先（target_staff_id）がある日報は、そのスタッフのみに表示
    if (includeTargetFilter) {
      if (currentStaffId) {
        internalQuery = internalQuery.or(`target_staff_id.is.null,target_staff_id.eq.${currentStaffId}`);
      } else {
        internalQuery = internalQuery.is('target_staff_id', null);
      }
    }
    
    return internalQuery;
  };

  let data: DiaryWithRelations[] | null = null;
  let error: any = null;

  // 1. target_staff_idフィルタありで試行（古い順）
  const queryWithTarget = applyTargetFilter(query, true).order('created_at', { ascending: true });
  
  const result1 = await queryWithTarget;
  
  if (result1.error) {
    if ((result1.error as any).code === '42703' && String((result1.error as any).message || '').includes('target_staff_id')) {
      const queryWithoutTarget = applyTargetFilter(query, false).order('created_at', { ascending: true });
      const result2 = await queryWithoutTarget;
      data = result2.data as DiaryWithRelations[];
      error = result2.error;
    } else {
      error = result1.error;
    }
  } else {
    data = result1.data as DiaryWithRelations[];
  }

  if (error) {
    console.error('Error fetching all unsolved diaries:', error);
    return [];
  }

  let diaries = data || [];

  // 返信を日付順にソート
  diaries.forEach(diary => {
    if (diary.replies) {
      diary.replies.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  });

  return diaries;
}

/**
 * カテゴリ一覧を取得
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('CATEGORY')
    .select('*')
    .eq('is_active', true)
    .order('category_id');

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data as Category[];
}

/**
 * 職種一覧を取得
 */
export async function getJobTypes() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('JOB_TYPE')
    .select('*')
    .order('job_type_id');

  if (error) {
    console.error('Error fetching job types:', error);
    return [];
  }

  return data;
}

/**
 * 日報を投稿
 */
export async function createDiary(input: CreateDiaryInput & { staff_id: number }) {
  const supabase = await createClient();

  // 日報を作成
  const { data: diary, error: diaryError } = await supabase
    .from('DIARY')
    .insert({
      category_id: input.category_id,
      staff_id: input.staff_id,
      title: input.title,
      content: input.content,
      target_date: input.target_date,
      is_urgent: input.is_urgent || false,
      bounty_points: input.bounty_points || null,
      current_status: 'UNREAD',
      parent_id: input.parent_id || null,
      deadline: input.deadline || null,
    })
    .select()
    .single();

  if (diaryError) {
    console.error('Error creating diary:', diaryError);
    return { success: false, error: diaryError.message };
  }

  // タグがあれば紐付け
  if (input.tag_ids && input.tag_ids.length > 0) {
    const tagInserts = input.tag_ids.map((tag_id) => ({
      diary_id: diary.diary_id,
      tag_id,
    }));

    await supabase.from('DIARY_TAG').insert(tagInserts);
  }

  // 投稿ポイントを付与
  const pointType = input.parent_id ? POINTS.REPLY : POINTS.POST_DIARY;
  const reason = input.parent_id ? '返信投稿' : '日報投稿';
  await addPoints(supabase, input.staff_id, pointType, reason, diary.diary_id);

  revalidatePath('/');
  return { success: true, data: diary };
}

// 繰り返しパターンの型
type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type CustomIntervalUnit = 'days' | 'weeks' | 'months' | 'years';

interface RecurrenceConfig {
  type: RecurrenceType;
  endDate: string; // YYYY-MM-DD
  weekDays?: number[]; // 0-6 (日-土) - 毎週用
  // カスタム（日付）用
  customInterval?: number;
  customIntervalUnit?: CustomIntervalUnit;
  // カスタム（曜日）用：複数の第N週と曜日
  customWeeksOfMonth?: number[]; // [1,2,3,4,5] 複数選択可
  customDaysOfWeek?: number[]; // [0-6] 複数選択可
  // 旧形式（後方互換）
  customWeekOfMonth?: number; // 1-5
  customDayOfWeek?: number; // 0-6
}

/**
 * 繰り返しパターンに基づいて日付リストを生成
 */
function generateRecurringDates(startDate: string, config: RecurrenceConfig): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${config.endDate}T00:00:00`);
  
  if (start > end) return dates;

  const addDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  };

  // 最大1000件まで（無限ループ防止）
  const MAX_DATES = 1000;

  switch (config.type) {
    case 'daily': {
      let current = new Date(start);
      while (current <= end && dates.length < MAX_DATES) {
        addDate(current);
        current.setDate(current.getDate() + 1);
      }
      break;
    }

    case 'weekly': {
      const weekDays = config.weekDays || [start.getDay()];
      let current = new Date(start);
      while (current <= end && dates.length < MAX_DATES) {
        if (weekDays.includes(current.getDay())) {
          addDate(current);
        }
        current.setDate(current.getDate() + 1);
      }
      break;
    }

    case 'monthly': {
      const dayOfMonth = start.getDate();
      let current = new Date(start);
      while (current <= end && dates.length < MAX_DATES) {
        // 月末日を超える場合は月末日を使用
        const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(dayOfMonth, lastDay));
        if (current <= end) {
          addDate(current);
        }
        current.setMonth(current.getMonth() + 1);
      }
      break;
    }

    case 'yearly': {
      const month = start.getMonth();
      const dayOfMonth = start.getDate();
      let current = new Date(start);
      while (current <= end && dates.length < MAX_DATES) {
        current.setMonth(month);
        const lastDay = new Date(current.getFullYear(), month + 1, 0).getDate();
        current.setDate(Math.min(dayOfMonth, lastDay));
        if (current <= end) {
          addDate(current);
        }
        current.setFullYear(current.getFullYear() + 1);
      }
      break;
    }

    case 'custom': {
      // カスタム（曜日）：複数の第N週と曜日の組み合わせ
      if (config.customWeeksOfMonth && config.customWeeksOfMonth.length > 0 &&
          config.customDaysOfWeek && config.customDaysOfWeek.length > 0) {
        let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        while (currentMonth <= end && dates.length < MAX_DATES) {
          // 選択された各週と各曜日の組み合わせで日付を生成
          for (const week of config.customWeeksOfMonth) {
            for (const day of config.customDaysOfWeek) {
              const targetDate = getNthWeekdayOfMonth(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                week,
                day
              );
              if (targetDate && targetDate >= start && targetDate <= end) {
                addDate(targetDate);
              }
            }
          }
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        // 日付を昇順にソート（複数の週・曜日で順番がバラバラになるため）
        dates.sort();
        break;
      }

      // 旧形式：単一の第N週と曜日
      if (config.customWeekOfMonth && config.customDayOfWeek !== undefined) {
        let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        const interval = config.customInterval || 1;
        while (currentMonth <= end && dates.length < MAX_DATES) {
          const targetDate = getNthWeekdayOfMonth(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            config.customWeekOfMonth,
            config.customDayOfWeek
          );
          if (targetDate && targetDate >= start && targetDate <= end) {
            addDate(targetDate);
          }
          currentMonth.setMonth(currentMonth.getMonth() + interval);
        }
        break;
      }

      // カスタム（日付）：〇日ごと、〇週ごと、〇ヶ月ごと、〇年ごと
      const interval = config.customInterval || 1;
      const unit = config.customIntervalUnit || 'days';
      let current = new Date(start);
      
      while (current <= end && dates.length < MAX_DATES) {
        addDate(current);
        switch (unit) {
          case 'days':
            current.setDate(current.getDate() + interval);
            break;
          case 'weeks':
            current.setDate(current.getDate() + interval * 7);
            break;
          case 'months':
            current.setMonth(current.getMonth() + interval);
            break;
          case 'years':
            current.setFullYear(current.getFullYear() + interval);
            break;
        }
      }
      break;
    }
  }

  return dates;
}

/**
 * 指定月の第N週の指定曜日の日付を取得
 */
function getNthWeekdayOfMonth(year: number, month: number, weekOfMonth: number, dayOfWeek: number): Date | null {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // 最初のその曜日の日を計算
  let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
  
  // 第N週の日を計算
  const targetDay = firstOccurrence + (weekOfMonth - 1) * 7;
  
  // 月末を超える場合はnull
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (targetDay > lastDay) return null;
  
  return new Date(year, month, targetDay);
}

/**
 * 繰り返し日報を一括作成
 */
export async function createRecurringDiaries(
  input: CreateDiaryInput & { staff_id: number },
  recurrence: RecurrenceConfig
) {
  const dates = generateRecurringDates(input.target_date, recurrence);
  
  if (dates.length === 0) {
    return { success: false, error: '繰り返し日付が生成されませんでした' };
  }

  if (dates.length > 100) {
    return { success: false, error: `繰り返し日報が多すぎます（${dates.length}件）。終了日を短くしてください。` };
  }

  const supabase = await createClient();
  const results: Array<{ date: string; success: boolean; error?: string }> = [];

  for (const date of dates) {
    const { data: diary, error: diaryError } = await supabase
      .from('DIARY')
      .insert({
        category_id: input.category_id,
        staff_id: input.staff_id,
        title: input.title,
        content: input.content,
        target_date: date,
        is_urgent: input.is_urgent || false,
        bounty_points: input.bounty_points || null,
        current_status: 'UNREAD',
        parent_id: null,
        deadline: input.deadline || null,
      })
      .select('diary_id')
      .single();

    if (diaryError) {
      results.push({ date, success: false, error: diaryError.message });
    } else {
      results.push({ date, success: true });
      // 投稿ポイントは最初の1件のみ
      if (date === dates[0]) {
        await addPoints(supabase, input.staff_id, POINTS.POST_DIARY, '日報投稿（繰り返し）', diary.diary_id);
      }
    }
  }

  revalidatePath('/');
  
  const successCount = results.filter((r) => r.success).length;
  return {
    success: true,
    data: {
      total: dates.length,
      successCount,
      results,
    },
  };
}

/**
 * ユーザーステータスを更新（トグル対応）
 */
export async function updateUserDiaryStatus(
  diaryId: number,
  staffId: number,
  status: UserStatus
) {
  const supabase = await createClient();

  // 現在のステータスを取得
  const { data: currentStatus } = await supabase
    .from('USER_DIARY_STATUS')
    .select('status')
    .eq('diary_id', diaryId)
    .eq('staff_id', staffId)
    .single();

  // 同じステータスなら解除（UNREADに戻す）
  const isToggleOff = currentStatus?.status === status;
  const newStatus = isToggleOff ? 'UNREAD' : status;
  let newDiaryStatus: string | undefined;

  // USER_DIARY_STATUSをupsert
  const { error: statusError } = await supabase
    .from('USER_DIARY_STATUS')
    .upsert(
      {
        diary_id: diaryId,
        staff_id: staffId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'diary_id,staff_id',
      }
    );

  if (statusError) {
    console.error('Error updating status:', statusError);
    return { success: false, error: statusError.message };
  }

  // ポイントロジック（トグル対応）
  const pointsAmount = getPointsForAction(status as UserStatus);
  
  if (!isToggleOff) {
    // ONにした場合：過去に同じアクションでポイントを得ていなければ付与
    const { data: existingLog } = await supabase
      .from('ACTION_LOG')
      .select('log_id')
      .eq('diary_id', diaryId)
      .eq('staff_id', staffId)
      .eq('action_type', status)
      .single();

    if (!existingLog) {
      // 初回のみポイント付与
      await supabase.from('ACTION_LOG').insert({
        diary_id: diaryId,
        staff_id: staffId,
        action_type: status,
        points_awarded: pointsAmount,
      });
      await addPoints(supabase, staffId, pointsAmount, `日報アクション: ${status}`, diaryId);
    }
  } else {
    // OFFにした場合：ポイントを取り消し
    // ACTION_LOGから該当レコードを削除
    const { data: existingLog } = await supabase
      .from('ACTION_LOG')
      .select('log_id, points_awarded')
      .eq('diary_id', diaryId)
      .eq('staff_id', staffId)
      .eq('action_type', status)
      .single();

    if (existingLog) {
      await supabase
        .from('ACTION_LOG')
        .delete()
        .eq('log_id', existingLog.log_id);
      
      // ポイントを減算
      await addPoints(supabase, staffId, -existingLog.points_awarded, `日報アクション取消: ${status}`, diaryId);
    }
  }

  // 解決ステータスの場合、DIARYテーブルも更新
  if (status === 'SOLVED') {
    if (!isToggleOff) {
      const solvedAt = new Date().toISOString();
      // 解決ONにした場合
      await supabase
        .from('DIARY')
        .update({
          current_status: 'SOLVED',
          solved_by: staffId,
          solved_at: solvedAt,
        })
        .eq('diary_id', diaryId);
      
      newDiaryStatus = 'SOLVED';
    } else {
      // 解決OFFにした場合、元のステータスに戻す
      // 作業中のユーザーがいればWORKING、確認済みのユーザーがいればCONFIRMED、それ以外はUNREAD
      const { data: statuses } = await supabase
        .from('USER_DIARY_STATUS')
        .select('status')
        .eq('diary_id', diaryId)
        .neq('status', 'UNREAD');

      let computedDiaryStatus = 'UNREAD';
      if (statuses?.some(s => s.status === 'WORKING')) {
        computedDiaryStatus = 'WORKING';
      } else if (statuses?.some(s => s.status === 'CONFIRMED')) {
        computedDiaryStatus = 'CONFIRMED';
      }

      await supabase
        .from('DIARY')
        .update({
          current_status: computedDiaryStatus,
          solved_by: null,
          solved_at: null,
        })
        .eq('diary_id', diaryId);
      
      newDiaryStatus = computedDiaryStatus;
    }
  } else if (!isToggleOff) {
    // 解決以外のステータスでONにした場合、DIARYのcurrent_statusを更新
    // 既にSOLVEDの場合は更新しない
    const { data: diary } = await supabase
      .from('DIARY')
      .select('current_status')
      .eq('diary_id', diaryId)
      .single();

    if (diary?.current_status !== 'SOLVED') {
      await supabase
        .from('DIARY')
        .update({ current_status: newStatus })
        .eq('diary_id', diaryId);
      
      newDiaryStatus = newStatus;
    }
  }

  revalidatePath('/');
  return { success: true, isToggleOff, newUserStatus: newStatus, newDiaryStatus };
}

/**
 * ポイントを付与する内部関数
 */
async function addPoints(
  supabase: SupabaseServerClient,
  staffId: number,
  amount: number,
  reason: string,
  diaryId?: number
) {
  // POINT_LOGに履歴を追加
  await supabase.from('POINT_LOG').insert({
    staff_id: staffId,
    amount: amount,
    reason: reason,
  });

  // STAFFのcurrent_pointsを更新
  const { data: staff } = await supabase
    .from('STAFF')
    .select('current_points')
    .eq('staff_id', staffId)
    .single();

  if (staff) {
    await supabase
      .from('STAFF')
      .update({ current_points: staff.current_points + amount })
      .eq('staff_id', staffId);
  }
}

/**
 * アクションタイプに応じたポイントを取得
 */
function getPointsForAction(status: UserStatus): number {
  switch (status) {
    case 'CONFIRMED':
      return POINTS.CONFIRM;
    case 'WORKING':
      return POINTS.WORKING;
    case 'SOLVED':
      return POINTS.SOLVED;
    default:
      return 0;
  }
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentStaff() {
  const supabase = await createClient();
  
  // Supabase Authからユーザーを取得
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  // メールアドレスでSTAFFを検索
  const { data: staff } = await supabase
    .from('STAFF')
    .select(`
      staff_id,
      name,
      email,
      job_type_id,
      system_role_id,
      is_active,
      current_points,
      personal_color,
      created_at,
      updated_at,
      job_type:JOB_TYPE(
        job_type_id,
        job_name
      ),
      system_role:SYSTEM_ROLE(
        role_id,
        role_name
      )
    `)
    .eq('email', user.email)
    .single();

  if (!staff) {
    return null;
  }

  // Supabaseのリレーションは配列で返されるため、オブジェクトに変換
  const jobTypeData = staff.job_type as unknown;
  const systemRoleData = staff.system_role as unknown;

  return {
    staff_id: staff.staff_id,
    name: staff.name,
    email: staff.email,
    job_type_id: staff.job_type_id,
    system_role_id: staff.system_role_id,
    is_active: staff.is_active,
    current_points: staff.current_points,
    personal_color: staff.personal_color,
    created_at: staff.created_at,
    updated_at: staff.updated_at,
    job_type: Array.isArray(jobTypeData) ? jobTypeData[0] : jobTypeData,
    system_role: Array.isArray(systemRoleData) ? systemRoleData[0] : systemRoleData,
  };
}

/**
 * 日報を更新
 */
export async function updateDiary(
  diaryId: number,
  input: {
    title?: string;
    content?: string;
    category_id?: number;
    is_urgent?: boolean;
    staff_id: number; // 投稿者または管理者チェック用
  }
) {
  const supabase = await createClient();

  // 現在のユーザーが管理者かチェック
  const currentStaff = await getCurrentStaff();
  const isAdmin = currentStaff?.system_role_id === 1;

  // 投稿者チェック
  const { data: diary } = await supabase
    .from('DIARY')
    .select('staff_id')
    .eq('diary_id', diaryId)
    .single();

  if (!diary) {
    return { success: false, error: '日報が見つかりません' };
  }

  // 投稿者または管理者のみ編集可能
  if (diary.staff_id !== input.staff_id && !isAdmin) {
    return { success: false, error: '編集権限がありません' };
  }

  // 更新
  const updateData: any = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.category_id !== undefined) updateData.category_id = input.category_id;
  if (input.is_urgent !== undefined) updateData.is_urgent = input.is_urgent;
  updateData.updated_at = new Date().toISOString();
  // 編集者を記録（updated_byカラムが存在する場合）
  // 注意: データベースにupdated_byカラムを追加する必要があります
  // 以下のSQLを実行してください:
  // ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES "STAFF"(staff_id);
  // カラムが存在する場合のみ保存
  try {
    updateData.updated_by = input.staff_id;
  } catch (e) {
    // カラムが存在しない場合は無視
  }

  const { error } = await supabase
    .from('DIARY')
    .update(updateData)
    .eq('diary_id', diaryId);

  if (error) {
    console.error('Error updating diary:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}

/**
 * 日報を削除（論理削除）
 */
export async function deleteDiary(diaryId: number, staffId: number) {
  const supabase = await createClient();

  // 現在のユーザーが管理者かチェック
  const currentStaff = await getCurrentStaff();
  const isAdmin = currentStaff?.system_role_id === 1;

  // 投稿者チェック
  const { data: diary } = await supabase
    .from('DIARY')
    .select('staff_id')
    .eq('diary_id', diaryId)
    .single();

  if (!diary) {
    return { success: false, error: '日報が見つかりません' };
  }

  // 投稿者または管理者のみ削除可能
  if (diary.staff_id !== staffId && !isAdmin) {
    return { success: false, error: '削除権限がありません' };
  }

  // 論理削除
  const { error } = await supabase
    .from('DIARY')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('diary_id', diaryId);

  if (error) {
    console.error('Error deleting diary:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}

