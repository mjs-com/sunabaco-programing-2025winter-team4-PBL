-- マイグレーション: 掃除当番の2名体制化（スロット追加）
-- 実行日: 2025-12-12
-- =============================================

-- 11. 掃除当番テーブルにslotカラムを追加し、主キーを複合キーに変更
-- 既存のデータをslot=1として保持

-- まずカラム追加
ALTER TABLE "CLEANING_DUTY_ASSIGNMENT" ADD COLUMN IF NOT EXISTS "slot" INTEGER DEFAULT 1 NOT NULL;

-- 既存の主キー制約を削除（制約名が不明な場合は確認が必要ですが、通常は cleaning_duty_assignment_pkey）
ALTER TABLE "CLEANING_DUTY_ASSIGNMENT" DROP CONSTRAINT IF EXISTS "CLEANING_DUTY_ASSIGNMENT_pkey";
-- または
ALTER TABLE "CLEANING_DUTY_ASSIGNMENT" DROP CONSTRAINT IF EXISTS "cleaning_duty_assignment_pkey";

-- 新しい複合主キーを設定
ALTER TABLE "CLEANING_DUTY_ASSIGNMENT" ADD PRIMARY KEY ("duty_date", "slot");
