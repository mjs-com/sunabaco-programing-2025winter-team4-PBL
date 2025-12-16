-- 完全削除機能のための中間テーブル作成
-- STAFFテーブルは変更せず、中間テーブルで管理
-- ※テーブル名は小文字で作成（Supabaseスキーマキャッシュ対応）

-- 既存のテーブルがあれば削除
DROP TABLE IF EXISTS PERMANENTLY_DELETED_STAFF;

-- 小文字でテーブルを作成
CREATE TABLE IF NOT EXISTS permanently_deleted_staff (
  staff_id INT PRIMARY KEY REFERENCES "STAFF"(staff_id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE permanently_deleted_staff IS '完全削除されたスタッフを記録（UI非表示だがデータ保持）';
COMMENT ON COLUMN permanently_deleted_staff.staff_id IS '完全削除されたスタッフID';
COMMENT ON COLUMN permanently_deleted_staff.deleted_at IS '完全削除日時';

-- 使い方:
-- is_deleted = true かつ このテーブルにレコードなし → 削除済み（復元可能）
-- is_deleted = true かつ このテーブルにレコードあり → 完全削除済み（画面非表示）
