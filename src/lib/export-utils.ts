import type { ExportDiaryData } from '@/app/actions/export';

/**
 * CSVフィールドをエスケープ（カンマ、改行、ダブルクォートを含む場合）
 */
function escapeCSVField(field: string): string {
  if (!field) return '';
  
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (field.includes(',') || field.includes('\n') || field.includes('"')) {
    // ダブルクォートをエスケープ（""に変換）
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return field;
}

/**
 * データをCSV形式に変換
 */
export function convertToCSV(data: ExportDiaryData[]): string {
  // BOMを追加（Excelで文字化けを防ぐため）
  const BOM = '\uFEFF';
  
  // ヘッダー行
  const headers = [
    '日報ID',
    '対象日付',
    '曜日',
    '週番号',
    '投稿日時',
    'タイトル',
    '本文',
    'カテゴリ',
    '緊急フラグ',
    '入力者名',
    '入力者職種',
    '宛先（メンション）',
    '現在ステータス',
    '解決日時',
    '解決者名',
    '解決者職種',
    '対応時間（時間）',
    '期限',
    '期限超過フラグ',
    '返信数',
    '返信文',
    '特別報酬ポイント',
  ];
  
  // CSV行を生成
  const rows = data.map((row) => [
    row.diary_id.toString(),
    row.target_date,
    row.day_of_week,
    row.week_number.toString(),
    row.created_at,
    escapeCSVField(row.title),
    escapeCSVField(row.content),
    escapeCSVField(row.category_name),
    row.is_urgent ? 'はい' : 'いいえ',
    escapeCSVField(row.input_staff_name),
    escapeCSVField(row.input_staff_job_type),
    escapeCSVField(row.mention),
    row.current_status,
    row.solved_at || '',
    escapeCSVField(row.solved_by_name),
    escapeCSVField(row.solved_by_job_type),
    row.response_time_hours?.toString() || '',
    row.deadline || '',
    row.is_deadline_overdue ? 'はい' : 'いいえ',
    row.reply_count.toString(),
    escapeCSVField(row.reply_content),
    row.bounty_points?.toString() || '',
  ]);
  
  // CSV文字列を生成
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');
  
  return BOM + csvContent;
}
