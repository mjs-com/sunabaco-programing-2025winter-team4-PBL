'use server';

import { createClient } from '@/lib/supabase/server';

export interface RankingFilter {
  category?: string; // 'all' | '診察' | '看護' | '事務' | 'その他'
  period?: string;   // 'all' | 'this_week' | 'this_month' | 'last_month'
  dayOfWeek?: string; // 'all' | '0' (日) ~ '6' (土)
  timeSlot?: string;  // 'all' | 'morning' (0-12時) | 'afternoon' (12-24時)
}

export interface RankingEntry {
  staff_id: number;
  name: string;
  job_type_name: string;
  total_points: number;
  rank: number;
}

/**
 * ポイントランキングを取得（Top5）
 */
export async function getRanking(filter: RankingFilter = {}): Promise<RankingEntry[]> {
  const supabase = await createClient();

  // スタッフ情報と職種を取得
  const { data: staffData, error: staffError } = await supabase
    .from('STAFF')
    .select('staff_id, name, job_type_id, current_points')
    .eq('is_active', true);

  if (staffError) {
    console.error('Error fetching staff:', staffError);
    return [];
  }

  // 職種情報を取得
  const { data: jobTypeData } = await supabase
    .from('JOB_TYPE')
    .select('job_type_id, job_name');

  const jobTypeMap = new Map(
    jobTypeData?.map(jt => [jt.job_type_id, jt.job_name]) || []
  );

  // フィルタなし（全期間）の場合、current_pointsを使用
  const hasNoFilters = 
    (!filter.period || filter.period === 'all') &&
    (!filter.category || filter.category === 'all') &&
    (!filter.dayOfWeek || filter.dayOfWeek === 'all') &&
    (!filter.timeSlot || filter.timeSlot === 'all');

  if (hasNoFilters) {
    // current_pointsでランキング作成
    const ranking: RankingEntry[] = (staffData || [])
      .filter(s => s.current_points > 0)
      .map(s => ({
        staff_id: s.staff_id,
        name: s.name,
        job_type_name: jobTypeMap.get(s.job_type_id) || '',
        total_points: s.current_points,
        rank: 0,
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 5);

    ranking.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return ranking;
  }

  // フィルタありの場合、ACTION_LOG または POINT_LOG から集計

  // 期間のフィルタ条件を構築
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  const now = new Date();

  switch (filter.period) {
    case 'this_week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFrom = startOfWeek.toISOString();
      dateTo = now.toISOString();
      break;
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = startOfMonth.toISOString();
      dateTo = now.toISOString();
      break;
    }
    case 'last_month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      dateFrom = startOfLastMonth.toISOString();
      dateTo = endOfLastMonth.toISOString();
      break;
    }
    default:
      break;
  }

  // カテゴリフィルタがある場合はACTION_LOGを使用（diary_idがあるため）
  if (filter.category && filter.category !== 'all') {
    // ACTION_LOGから取得
    let query = supabase
      .from('ACTION_LOG')
      .select('staff_id, points_awarded, created_at, diary_id');

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error('Error fetching action logs:', logsError);
      return [];
    }

    // カテゴリ情報を取得
    const diaryIds = Array.from(new Set(logs?.filter(l => l.diary_id).map(l => l.diary_id) || []));
    let diaryCategories = new Map<number, string>();
    
    if (diaryIds.length > 0) {
      const { data: diaryData } = await supabase
        .from('DIARY')
        .select('diary_id, category_id')
        .in('diary_id', diaryIds);

      const { data: categoryData } = await supabase
        .from('CATEGORY')
        .select('category_id, category_name');

      const categoryMap = new Map(
        categoryData?.map(c => [c.category_id, c.category_name]) || []
      );

      diaryData?.forEach(d => {
        const categoryName = categoryMap.get(d.category_id);
        if (categoryName) {
          diaryCategories.set(d.diary_id, categoryName);
        }
      });
    }

    // フィルタリングとスタッフごとの合計を計算
    const pointsByStaff = new Map<number, number>();

    for (const log of logs || []) {
      // 曜日フィルタ
      if (filter.dayOfWeek && filter.dayOfWeek !== 'all') {
        const logDate = new Date(log.created_at);
        if (logDate.getDay().toString() !== filter.dayOfWeek) continue;
      }

      // 時間帯フィルタ
      if (filter.timeSlot && filter.timeSlot !== 'all') {
        const logDate = new Date(log.created_at);
        const hour = logDate.getHours();
        if (filter.timeSlot === 'morning' && hour >= 12) continue;
        if (filter.timeSlot === 'afternoon' && hour < 12) continue;
      }

      // カテゴリフィルタ
      if (log.diary_id) {
        const categoryName = diaryCategories.get(log.diary_id);
        if (categoryName !== filter.category) continue;
      }

      const currentPoints = pointsByStaff.get(log.staff_id) || 0;
      pointsByStaff.set(log.staff_id, currentPoints + log.points_awarded);
    }

    // ランキング作成
    const staffMap = new Map(
      staffData?.map(s => [s.staff_id, { name: s.name, job_type_id: s.job_type_id }]) || []
    );

    const ranking: RankingEntry[] = [];
    Array.from(pointsByStaff.entries()).forEach(([staffId, totalPoints]) => {
      const staffInfo = staffMap.get(staffId);
      if (staffInfo && totalPoints > 0) {
        ranking.push({
          staff_id: staffId,
          name: staffInfo.name,
          job_type_name: jobTypeMap.get(staffInfo.job_type_id) || '',
          total_points: totalPoints,
          rank: 0,
        });
      }
    });

    ranking.sort((a, b) => b.total_points - a.total_points);
    ranking.forEach((entry, index) => { entry.rank = index + 1; });
    return ranking.slice(0, 5);
  }

  // カテゴリフィルタなしの場合、POINT_LOGを使用
  let query = supabase
    .from('POINT_LOG')
    .select('staff_id, amount, created_at');

  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  const { data: logs, error: logsError } = await query;

  if (logsError) {
    console.error('Error fetching point logs:', logsError);
    return [];
  }

  // フィルタリングとスタッフごとの合計を計算
  const pointsByStaff = new Map<number, number>();

  for (const log of logs || []) {
    // 曜日フィルタ
    if (filter.dayOfWeek && filter.dayOfWeek !== 'all') {
      const logDate = new Date(log.created_at);
      if (logDate.getDay().toString() !== filter.dayOfWeek) continue;
    }

    // 時間帯フィルタ
    if (filter.timeSlot && filter.timeSlot !== 'all') {
      const logDate = new Date(log.created_at);
      const hour = logDate.getHours();
      if (filter.timeSlot === 'morning' && hour >= 12) continue;
      if (filter.timeSlot === 'afternoon' && hour < 12) continue;
    }

    const currentPoints = pointsByStaff.get(log.staff_id) || 0;
    pointsByStaff.set(log.staff_id, currentPoints + log.amount);
  }

  // ランキング作成
  const staffMap = new Map(
    staffData?.map(s => [s.staff_id, { name: s.name, job_type_id: s.job_type_id }]) || []
  );

  const ranking: RankingEntry[] = [];
  Array.from(pointsByStaff.entries()).forEach(([staffId, totalPoints]) => {
    const staffInfo = staffMap.get(staffId);
    if (staffInfo && totalPoints > 0) {
      ranking.push({
        staff_id: staffId,
        name: staffInfo.name,
        job_type_name: jobTypeMap.get(staffInfo.job_type_id) || '',
        total_points: totalPoints,
        rank: 0,
      });
    }
  });

  ranking.sort((a, b) => b.total_points - a.total_points);
  ranking.forEach((entry, index) => { entry.rank = index + 1; });
  return ranking.slice(0, 5);
}

/**
 * カテゴリ一覧を取得
 */
export async function getCategoriesForRanking(): Promise<string[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('CATEGORY')
    .select('category_name')
    .order('category_id');

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data?.map(c => c.category_name) || [];
}
