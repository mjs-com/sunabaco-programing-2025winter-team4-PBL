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

/**
 * HSL形式の色をhex形式に変換
 */
export function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#e2e8f0'; // デフォルト色

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255);
    return val.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 色の文字列（HSL形式またはhex形式）をhex形式に変換
 */
export function colorToHex(color: string | null | undefined): string {
  if (!color) return '#e2e8f0';
  if (color.startsWith('#')) return color;
  if (color.startsWith('hsl')) return hslToHex(color);
  return '#e2e8f0';
}

