'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentStaff } from './diary';

/**
 * エクスポート用の日報データ型
 */
export interface ExportDiaryData {
  diary_id: number;
  target_date: string;
  day_of_week: string;
  week_number: number;
  created_at: string; // 日本時刻の読みやすい形式
  title: string;
  content: string;
  category_name: string;
  is_urgent: boolean;
  input_staff_name: string;
  input_staff_job_type: string;
  mention: string; // 本文内のメンション（@all, @職種, @個人名）
  current_status: string;
  solved_at: string | null;
  solved_by_name: string;
  solved_by_job_type: string;
  response_time_hours: number | null;
  deadline: string | null;
  is_deadline_overdue: boolean;
  reply_count: number;
  reply_content: string; // 返信文（改行区切りで結合）
  bounty_points: number | null;
}

/**
 * 指定期間の日報データを取得（エクスポート用）
 */
export async function getDiariesForExport(
  startDate: string,
  endDate: string
): Promise<ExportDiaryData[]> {
  const supabase = await createClient();

  // 管理者権限チェック
  const currentStaff = await getCurrentStaff();
  if (!currentStaff || currentStaff.system_role_id !== 1) {
    throw new Error('管理者権限が必要です');
  }

  // 職種一覧とスタッフ一覧を取得（メンション抽出用）
  const { data: jobTypes } = await supabase
    .from('JOB_TYPE')
    .select('job_type_id, job_name')
    .eq('is_active', true);
  
  const { data: allStaff } = await supabase
    .from('STAFF')
    .select('staff_id, name, job_type_id')
    .eq('is_active', true);

  // 日報データを取得（親記事のみ、削除・非表示を除く）
  const { data: diaries, error } = await supabase
    .from('DIARY')
    .select(`
      diary_id,
      target_date,
      created_at,
      title,
      content,
      is_urgent,
      current_status,
      solved_at,
      deadline,
      bounty_points,
      category:CATEGORY(
        category_name
      ),
      staff:STAFF!DIARY_staff_id_fkey(
        name,
        job_type:JOB_TYPE(
          job_name
        )
      ),
      solved_by_staff:STAFF!DIARY_solved_by_fkey(
        name,
        job_type:JOB_TYPE(
          job_name
        )
      ),
      replies:DIARY!parent_id(
        diary_id,
        content,
        created_at,
        staff:STAFF!DIARY_staff_id_fkey(
          name
        )
      )
    `)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .is('parent_id', null)
    .gte('target_date', startDate)
    .lte('target_date', endDate)
    .order('target_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching diaries for export:', error);
    throw new Error('データの取得に失敗しました');
  }

  if (!diaries) {
    return [];
  }

  /**
   * 本文からメンションを抽出
   * @の後に続く文字列を抽出して、All/職種名/個人名に一致するものを返す
   */
  function extractMentions(content: string): string {
    if (!content) return '';
    
    const mentions: string[] = [];
    
    // 正規表現で@の後に続く文字列を抽出（スペース、改行、@以外の文字まで）
    // 大文字小文字を区別しない（iフラグ）
    const mentionPattern = /@([^\s@\n]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const foundMentions = new Set<string>();
    
    for (const match of matches) {
      const mentionText = match[1]; // @の後の文字列（大文字小文字混在の可能性あり）
      const mentionTextLower = mentionText.toLowerCase();
      
      // @All, @all, @ALL などをチェック（大文字小文字を区別しない）
      if (mentionTextLower === 'all' && !foundMentions.has('全体')) {
        mentions.push('全体');
        foundMentions.add('全体');
        continue;
      }
      
      // @職種名 をチェック（大文字小文字を区別しない）
      if (jobTypes) {
        const matchedJobType = jobTypes.find((jt: any) => 
          jt.job_name.toLowerCase() === mentionTextLower || jt.job_name === mentionText
        );
        if (matchedJobType && !foundMentions.has(matchedJobType.job_name)) {
          mentions.push(matchedJobType.job_name);
          foundMentions.add(matchedJobType.job_name);
          continue;
        }
      }
      
      // @個人名 をチェック（大文字小文字を区別しない）
      if (allStaff) {
        const matchedStaff = allStaff.find((staff: any) => 
          staff.name.toLowerCase() === mentionTextLower || staff.name === mentionText
        );
        if (matchedStaff && !foundMentions.has(matchedStaff.name)) {
          mentions.push(matchedStaff.name);
          foundMentions.add(matchedStaff.name);
        }
      }
    }
    
    // 改行区切りで返す（複数のメンションがある場合）
    return mentions.join('\n') || '';
  }
  
  /**
   * 日時を日本時刻の読みやすい形式に変換
   */
  function formatJapaneseDateTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    // JSTに変換してフォーマット（YYYY/MM/DD HH:mm）
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date).replace(/\//g, '/');
  }

  // データを整形
  const exportData: ExportDiaryData[] = diaries.map((diary: any) => {
    const targetDate = new Date(diary.target_date);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][targetDate.getDay()];
    
    // 週番号を計算（ISO 8601週番号）
    const weekNumber = getWeekNumber(targetDate);
    
    // 対応時間を計算（時間単位）
    let responseTimeHours: number | null = null;
    if (diary.solved_at && diary.created_at) {
      const created = new Date(diary.created_at);
      const solved = new Date(diary.solved_at);
      responseTimeHours = Math.round((solved.getTime() - created.getTime()) / (1000 * 60 * 60) * 10) / 10;
    }
    
    // 期限超過フラグ
    let isDeadlineOverdue = false;
    if (diary.deadline && diary.solved_at) {
      isDeadlineOverdue = new Date(diary.solved_at) > new Date(diary.deadline);
    } else if (diary.deadline && !diary.solved_at) {
      // 未解決でも期限を過ぎていれば超過
      isDeadlineOverdue = new Date() > new Date(diary.deadline);
    }
    
    // 返信数と返信文
    const replies = Array.isArray(diary.replies) ? diary.replies : [];
    const replyCount = replies.length;
    // 返信文を日付順にソートして結合
    const sortedReplies = [...replies].sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const replyContent = sortedReplies
      .map((reply: any) => {
        const content = reply.content || '';
        if (!content.trim()) return '';
        
        // 返信者名を取得
        const replyStaff = Array.isArray(reply.staff) ? reply.staff[0] : reply.staff;
        const replyStaffName = replyStaff?.name || '不明';
        
        // [返信者名]\n返信内容 の形式で返す
        return `[${replyStaffName}]\n${content}`;
      })
      .filter((formattedReply: string) => formattedReply.trim() !== '')
      .join('\n---\n');
    
    // カテゴリ名
    const categoryName = Array.isArray(diary.category) 
      ? (diary.category[0]?.category_name || '')
      : (diary.category?.category_name || '');
    
    // 入力者情報
    const staff = Array.isArray(diary.staff) ? diary.staff[0] : diary.staff;
    const inputStaffName = staff?.name || '';
    const inputStaffJobType = Array.isArray(staff?.job_type)
      ? (staff.job_type[0]?.job_name || '')
      : (staff?.job_type?.job_name || '');
    
    // メンション抽出
    const mention = extractMentions(diary.content || '');
    
    // 解決者情報
    const solvedByStaff = Array.isArray(diary.solved_by_staff) ? diary.solved_by_staff[0] : diary.solved_by_staff;
    const solvedByName = solvedByStaff?.name || '';
    const solvedByJobType = Array.isArray(solvedByStaff?.job_type)
      ? (solvedByStaff.job_type[0]?.job_name || '')
      : (solvedByStaff?.job_type?.job_name || '');

    return {
      diary_id: diary.diary_id,
      target_date: diary.target_date,
      day_of_week: dayOfWeek,
      week_number: weekNumber,
      created_at: formatJapaneseDateTime(diary.created_at),
      title: diary.title || '',
      content: diary.content || '',
      category_name: categoryName,
      is_urgent: diary.is_urgent || false,
      input_staff_name: inputStaffName,
      input_staff_job_type: inputStaffJobType,
      mention: mention,
      current_status: diary.current_status || 'UNREAD',
      solved_at: diary.solved_at ? formatJapaneseDateTime(diary.solved_at) : null,
      solved_by_name: solvedByName,
      solved_by_job_type: solvedByJobType,
      response_time_hours: responseTimeHours,
      deadline: diary.deadline || null,
      is_deadline_overdue: isDeadlineOverdue,
      reply_count: replyCount,
      reply_content: replyContent,
      bounty_points: diary.bounty_points || null,
    };
  });

  return exportData;
}

/**
 * ISO 8601週番号を計算
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

