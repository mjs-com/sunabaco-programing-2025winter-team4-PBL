/**
 * データベース型定義
 * Supabaseスキーマに基づくTypeScript型
 */

// ==========================================
// マスタテーブル型
// ==========================================

export interface JobType {
  job_type_id: number;
  job_name: string;
  is_active: boolean;
}

export interface SystemRole {
  role_id: number;
  role_name: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  is_active: boolean;
}

export interface Tag {
  tag_id: number;
  tag_name: string;
  css_class: string;
  is_active: boolean;
}

// ==========================================
// ユーザー管理型
// ==========================================

export interface Staff {
  staff_id: number;
  name: string;
  login_id: string;
  password_hash: string;
  email: string;
  job_type_id: number;
  system_role_id: number;
  is_active: boolean;
  is_hidden: boolean; // 非表示フラグ（産休などで一時的に非表示）
  is_deleted: boolean; // 削除フラグ（退職などで完全に削除、ただしデータは保持）
  current_points: number;
  personal_color?: string | null; // パーソナルカラー（カレンダー表示用）
  created_at: string;
  updated_at: string;
}

// リレーション込みのスタッフ型
export interface StaffWithRelations extends Staff {
  job_type?: JobType;
  system_role?: SystemRole;
}

// スタッフ一覧用の軽量型（メンション・選択リスト用）
export interface StaffBasicInfo {
  staff_id: number;
  name: string;
  job_type_id: number;
  personal_color?: string | null;
  job_type?: {
    job_type_id: number;
    job_name: string;
  };
}

// 現在のログインユーザー情報用の型（パスワードハッシュなどを含まない）
export interface CurrentStaffInfo {
  staff_id: number;
  name: string;
  email: string;
  job_type_id: number;
  system_role_id: number;
  is_active: boolean;
  is_hidden: boolean;
  is_deleted: boolean;
  current_points: number;
  personal_color?: string | null;
  created_at: string;
  updated_at: string;
  job_type?: JobType;
  system_role?: SystemRole;
}

// ==========================================
// 日報データ型
// ==========================================

// ステータス定数
export const DIARY_STATUS = {
  UNREAD: 'UNREAD',
  CONFIRMED: 'CONFIRMED',
  WORKING: 'WORKING',
  SOLVED: 'SOLVED',
} as const;

export type DiaryStatus = typeof DIARY_STATUS[keyof typeof DIARY_STATUS];

// 日報種別（システム生成など）
export const DIARY_TYPE = {
  NORMAL: 'NORMAL',
  CLEANING_DUTY: 'CLEANING_DUTY',
} as const;

export type DiaryType = typeof DIARY_TYPE[keyof typeof DIARY_TYPE];

// ユーザーステータス定数
export const USER_STATUS = {
  UNREAD: 'UNREAD',
  CONFIRMED: 'CONFIRMED',
  WORKING: 'WORKING',
  SOLVED: 'SOLVED',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

export interface Diary {
  diary_id: number;
  parent_id: number | null;
  category_id: number;
  staff_id: number;
  title: string;
  content: string;
  target_date: string;
  is_urgent: boolean;
  bounty_points: number | null;
  is_hidden: boolean;
  is_deleted: boolean;
  current_status: DiaryStatus;
  diary_type?: DiaryType; // 日報種別（追加）
  target_staff_id?: number | null; // 宛先（NULL=全体公開）
  created_at: string;
  updated_at: string;
  updated_by?: number | null; // 編集者
  deadline?: string | null; // 期限
  solved_by?: number | null; // 解決者
  solved_at?: string | null; // 解決日時
}

// リレーション込みの日報型
export interface DiaryWithRelations extends Diary {
  category?: Category;
  staff?: Staff;
  updated_by_staff?: Staff; // 編集者情報
  solved_by_staff?: Staff; // 解決者情報
  tags?: Tag[];
  user_statuses?: UserDiaryStatusWithStaff[];
  replies?: DiaryWithRelations[];
}

// ==========================================
// 日報タグ中間テーブル型
// ==========================================

export interface DiaryTag {
  id: number;
  diary_id: number;
  tag_id: number;
}

// ==========================================
// ユーザー既読・作業状態型
// ==========================================

export interface UserDiaryStatus {
  id: number;
  diary_id: number;
  staff_id: number;
  status: UserStatus;
  updated_at: string;
}

export interface UserDiaryStatusWithStaff extends UserDiaryStatus {
  staff?: Staff;
}

// ==========================================
// 行動ログ型
// ==========================================

export const ACTION_TYPE = {
  CONFIRM: 'CONFIRM',
  WORKING: 'WORKING',
  SOLVED: 'SOLVED',
  REPLY: 'REPLY',
} as const;

export type ActionType = typeof ACTION_TYPE[keyof typeof ACTION_TYPE];

export interface ActionLog {
  log_id: number;
  diary_id: number | null;
  staff_id: number;
  action_type: ActionType;
  points_awarded: number;
  created_at: string;
}

// ==========================================
// ポイント履歴型
// ==========================================

export interface PointLog {
  point_log_id: number;
  staff_id: number;
  amount: number;
  reason: string;
  created_at: string;
}

// ==========================================
// 掃除当番（割当）型
// ==========================================

export interface CleaningDutyAssignment {
  duty_date: string; // YYYY-MM-DD
  staff_id: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// フォーム・リクエスト用型
// ==========================================

export interface CreateDiaryInput {
  category_id: number;
  title: string;
  content: string;
  target_date: string;
  is_urgent?: boolean;
  bounty_points?: number | null;
  tag_ids?: number[];
  parent_id?: number;
  deadline?: string | null;
}

export interface UpdateStatusInput {
  diary_id: number;
  status: UserStatus;
}

// ==========================================
// API レスポンス型
// ==========================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ==========================================
// ポイント設定
// ==========================================

export const POINT_CONFIG = {
  CONFIRM: 1,
  WORKING: 2,
  SOLVED: 5,
  REPLY: 3,
  POST_DIARY: 2,
} as const;

