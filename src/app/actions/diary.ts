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
  currentStaffName?: string
): Promise<DiaryWithRelations[]> {
  const supabase = await createClient();

  // 外部キーを明示的に指定（複数の外部キーがSTAFFを参照するため）
  const baseQuery = supabase
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
    .eq('target_date', targetDate)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .is('parent_id', null);

  // 条件を組み立て（DBに target_staff_id がない環境でも動くようにフォールバック）
  const applyFilters = (q: typeof baseQuery, opts: { includeTargetFilter: boolean }) => {
    let query = q;

    // 宛先（target_staff_id）がある日報は、そのスタッフのみに表示
    // ※ target_staff_id が未導入のDBでは、この条件を付けるとエラーになるためフォールバックします
    if (opts.includeTargetFilter) {
      if (currentStaffId) {
        query = query.or(`target_staff_id.is.null,target_staff_id.eq.${currentStaffId}`);
      } else {
        query = query.is('target_staff_id', null);
      }
    }

    // 至急フィルター
    if (filter === 'urgent') {
      query = query.eq('is_urgent', true);
    }

    return query;
  };

  let { data, error } = await applyFilters(baseQuery, { includeTargetFilter: true }).order('created_at', { ascending: false });

  // target_staff_id 未導入のDBの場合は、宛先フィルタを外して再試行
  if (error && (error as any).code === '42703' && String((error as any).message || '').includes('target_staff_id')) {
    ({ data, error } = await applyFilters(baseQuery, { includeTargetFilter: false }).order('created_at', { ascending: false }));
  }

  if (error) {
    console.error('Error fetching diaries:', error);
    return [];
  }

  let diaries = data as DiaryWithRelations[];

  // TODOフィルター（自分宛てのみ表示）
  if (filter === 'todo' && currentStaffId) {
    diaries = diaries.filter(diary => {
      // 未解決のみ
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

  // 並び替え: 未解決を上、解決済みを下
  // 未解決の中では期限が近い順 > 作成日が新しい順
  diaries.sort((a, b) => {
    // 解決済みは下に
    if (a.current_status === 'SOLVED' && b.current_status !== 'SOLVED') return 1;
    if (a.current_status !== 'SOLVED' && b.current_status === 'SOLVED') return -1;
    
    // 両方とも未解決の場合、期限でソート
    if (a.current_status !== 'SOLVED' && b.current_status !== 'SOLVED') {
      // 期限がある場合は期限順
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      // 片方だけ期限がある場合、期限があるほうを上に
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
    }
    
    // 期限がない場合は作成日順（新しい順）
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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

