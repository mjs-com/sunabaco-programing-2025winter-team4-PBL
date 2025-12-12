import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwindクラスを結合するユーティリティ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 日付をフォーマットする
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 日付をISO形式（YYYY-MM-DD）で取得
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 時刻をフォーマットする（HH:MM形式）
 */
export function formatTime(dateString: string): string {
  const d = new Date(dateString);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 名前からイニシャルを取得する
 */
export function getInitial(name: string): string {
  if (!name) return '?';
  // 姓名がスペースで区切られている場合は名の最初の文字
  const parts = name.split(/[\s　]+/);
  if (parts.length >= 2) {
    return parts[1].charAt(0);
  }
  // 区切りがない場合は最後の文字
  return name.charAt(name.length - 1);
}

/**
 * 日付を1日進める
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 今日の日付を取得
 */
export function getToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * ランダムなパーソナルカラーを生成（明るめで見やすい色）
 */
export function generateRandomPersonalColor(): string {
  // HSL色空間で彩度と明度を固定し、色相だけランダムにすることで見やすい色を生成
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.floor(Math.random() * 20); // 65-85%
  const lightness = 75 + Math.floor(Math.random() * 10); // 75-85% (明るめ)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * スタッフIDから一貫したパーソナルカラーを生成（DBに色が未設定の場合のフォールバック）
 * 同じIDからは常に同じ色が生成される
 */
export function getStaffColorById(staffId: number): string {
  // Golden angle (約137.5度) を使って色相を均等に分散
  const goldenAngle = 137.508;
  const hue = (staffId * goldenAngle) % 360;
  const saturation = 70;
  const lightness = 80; // 明るめで見やすい
  return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
}

