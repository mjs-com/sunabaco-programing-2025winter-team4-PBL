-- =============================================
-- マイグレーション: 期限・解決者機能追加
-- 実行日: 2025-12-12
-- =============================================

-- 1. 期限カラムの追加（まだ追加されていない場合）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS deadline DATE;

-- 2. 解決者カラムの追加
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_by INT REFERENCES "STAFF"(staff_id);

-- 3. 解決日時カラムの追加
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_at TIMESTAMP WITH TIME ZONE;

-- 4. 編集者カラムの追加（既に追加されている場合はスキップ）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES "STAFF"(staff_id);

-- =============================================
-- マイグレーション: 掃除当番機能追加
-- 実行日: 2025-12-12
-- =============================================

-- 5. 日報の種別（通常/掃除当番など）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS diary_type TEXT NOT NULL DEFAULT 'NORMAL';

-- 6. 日報の宛先（NULL=全体公開、値あり=指定スタッフのみ表示）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS target_staff_id INT REFERENCES "STAFF"(staff_id);

-- 7. 掃除当番の割当（1日=1人）
CREATE TABLE IF NOT EXISTS "CLEANING_DUTY_ASSIGNMENT" (
  duty_date DATE PRIMARY KEY,
  staff_id INT NOT NULL REFERENCES "STAFF"(staff_id),
  created_by INT REFERENCES "STAFF"(staff_id),
  updated_by INT REFERENCES "STAFF"(staff_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cleaning_duty_assignment_staff_id_idx"
  ON "CLEANING_DUTY_ASSIGNMENT"(staff_id);

-- 8. 掃除当番用カテゴリ（なければ追加）
INSERT INTO "CATEGORY" (category_name, is_active)
SELECT '掃除当番', true
WHERE NOT EXISTS (
  SELECT 1 FROM "CATEGORY" WHERE category_name = '掃除当番'
);

-- 9. 掃除当番日報は「日付×種別」で一意（返信は除外）
CREATE UNIQUE INDEX IF NOT EXISTS "diary_cleaning_duty_unique"
  ON "DIARY"(target_date, diary_type)
  WHERE diary_type = 'CLEANING_DUTY' AND parent_id IS NULL;

-- =============================================
-- 確認用クエリ
-- =============================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'DIARY';
