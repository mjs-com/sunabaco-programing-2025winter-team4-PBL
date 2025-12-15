-- =============================================
-- クリニック日報アプリ データベース設定
-- =============================================
-- Supabase SQL Editorで実行するSQL文

-- =============================================
-- 1. データベース設定と初期化
-- =============================================
-- 外部キー制約を有効化し、データ整合性を確保します。
SET session_replication_role = 'replica';
-- 既存のテーブルを削除する場合のコメントアウト（開発初期のみ）
-- DROP TABLE IF EXISTS "POINT_LOG", "ACTION_LOG", "USER_DIARY_STATUS", "DIARY_TAG", "DIARY", "TAG", "CATEGORY", "SYSTEM_ROLE", "JOB_TYPE", "STAFF" CASCADE;
SET session_replication_role = 'origin';

-- =============================================
-- 2. マスタデータ (Master Data)
-- =============================================

-- 職種マスタ (医師, 看護師, 事務など)
CREATE TABLE "JOB_TYPE" (
    job_type_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE -- 無効化フラグ
);

-- システム権限マスタ (管理者, 一般ユーザーなど)
CREATE TABLE "SYSTEM_ROLE" (
    role_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE
);

-- 分野マスタ (診察, 看護, 事務など)
CREATE TABLE "CATEGORY" (
    category_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE -- 無効化フラグ
);

-- 任意タグマスタ (備品, 教育, クレームなど)
CREATE TABLE "TAG" (
    tag_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    css_class TEXT NOT NULL, -- フロントでの色分け用クラス名 (例: 'tag-danger')
    is_active BOOLEAN NOT NULL DEFAULT TRUE -- 無効化フラグ
);

-- =============================================
-- 3. ユーザー管理 (STAFF)
-- =============================================

CREATE TABLE "STAFF" (
    staff_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    login_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- ログイン用ハッシュ
    email TEXT UNIQUE NOT NULL, -- パスワード再設定などに利用
    
    job_type_id INT NOT NULL REFERENCES "JOB_TYPE"(job_type_id),
    system_role_id INT NOT NULL REFERENCES "SYSTEM_ROLE"(role_id),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE, -- 非表示フラグ（産休などで一時的に非表示）
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 削除フラグ（退職などで完全に削除、ただしデータは保持）
    current_points INT NOT NULL DEFAULT 0, -- パフォーマンス用キャッシュ（累計ポイント）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 4. 日報データ (DIARY)
-- =============================================

CREATE TABLE "DIARY" (
    diary_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- リレーション
    parent_id BIGINT REFERENCES "DIARY"(diary_id), -- 返信用自己参照
    category_id INT NOT NULL REFERENCES "CATEGORY"(category_id),
    staff_id INT NOT NULL REFERENCES "STAFF"(staff_id), -- 作成者
    updated_by INT REFERENCES "STAFF"(staff_id), -- 最終編集者（編集履歴用）
    solved_by INT REFERENCES "STAFF"(staff_id), -- 解決者
    target_staff_id INT REFERENCES "STAFF"(staff_id), -- 宛先（NULL=全体公開、値あり=指定スタッフのみ表示）
    
    -- コンテンツ
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- 状態と制御
    target_date DATE NOT NULL, -- 何日の日報か
    deadline DATE, -- 期限日（任意、NULLの場合は期限なし）
    diary_type TEXT NOT NULL DEFAULT 'NORMAL', -- 日報種別（NORMAL=通常、CLEANING_DUTY=掃除当番）
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE, -- 至急フラグ
    bounty_points INT, -- 特別報酬ポイント (NULLの場合はデフォルト適用)
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE, -- 表示OFF (アーカイブ)
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 論理削除 (ゴミ箱)
    current_status TEXT NOT NULL DEFAULT 'UNREAD', -- 現在の記事の状態 (UNREAD, CONFIRMED, WORKING, SOLVED)
    solved_at TIMESTAMP WITH TIME ZONE, -- 解決日時
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DIARYとTAGの中間テーブル (多対多)
CREATE TABLE "DIARY_TAG" (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diary_id BIGINT NOT NULL REFERENCES "DIARY"(diary_id),
    tag_id INT NOT NULL REFERENCES "TAG"(tag_id),
    UNIQUE (diary_id, tag_id) -- 同じタグが二重に付かないようにする
);

-- =============================================
-- 5. ログとステータス管理 (Logs & Status)
-- =============================================

-- ユーザーごとの既読・作業状態
CREATE TABLE "USER_DIARY_STATUS" (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diary_id BIGINT NOT NULL REFERENCES "DIARY"(diary_id),
    staff_id INT NOT NULL REFERENCES "STAFF"(staff_id),
    status TEXT NOT NULL, -- (UNREAD, CONFIRMED, WORKING, SOLVED)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diary_id, staff_id) -- 1つのメモにつき1ユーザー1レコードのみ
);

-- 行動ログ (ポイント付与トリガー)
CREATE TABLE "ACTION_LOG" (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    diary_id BIGINT REFERENCES "DIARY"(diary_id), -- どの記事へのアクションか
    staff_id INT NOT NULL REFERENCES "STAFF"(staff_id), -- 誰のアクションか
    action_type TEXT NOT NULL, -- (CONFIRM, WORKING, SOLVED, REPLY)
    points_awarded INT NOT NULL, -- 付与されたポイント数 (プログラム側で決定)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ポイント履歴 (通帳)
CREATE TABLE "POINT_LOG" (
    point_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES "STAFF"(staff_id),
    amount INT NOT NULL, -- 増減値 (+10, -5など)
    reason TEXT NOT NULL, -- 理由 (ログインボーナス, 日報解決など)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 掃除当番管理 (Cleaning Duty)
-- =============================================

-- 掃除当番の割当（1日=1人）
CREATE TABLE "CLEANING_DUTY_ASSIGNMENT" (
    duty_date DATE PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES "STAFF"(staff_id), -- 当番者
    created_by INT REFERENCES "STAFF"(staff_id),
    updated_by INT REFERENCES "STAFF"(staff_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "cleaning_duty_assignment_staff_id_idx"
    ON "CLEANING_DUTY_ASSIGNMENT"(staff_id);

-- 掃除当番日報は「日付×種別」で一意（返信は除外）
CREATE UNIQUE INDEX "diary_cleaning_duty_unique"
    ON "DIARY"(target_date, diary_type)
    WHERE diary_type = 'CLEANING_DUTY' AND parent_id IS NULL;


-- =============================================
-- 6. 初期データ投入の例
-- =============================================

-- マスタデータ
INSERT INTO "JOB_TYPE" (job_name, is_active) VALUES 
    ('医師', true), 
    ('看護師', true), 
    ('医療事務', true);
INSERT INTO "SYSTEM_ROLE" (role_name) VALUES ('管理者'), ('一般ユーザー');
INSERT INTO "CATEGORY" (category_name, is_active) VALUES 
    ('診察', true), 
    ('看護', true), 
    ('事務', true), 
    ('その他', true),
    ('掃除当番', true); -- 掃除当番用カテゴリ
INSERT INTO "TAG" (tag_name, css_class, is_active) VALUES 
    ('備品関連', 'tag-blue', true), 
    ('教育', 'tag-green', true);

-- 初期STAFF（ログインテスト用）
-- ※Supabase Authでユーザーを作成し、そのemailと一致させる必要があります
INSERT INTO "STAFF" (name, login_id, password_hash, email, job_type_id, system_role_id) 
VALUES 
('鈴木 太郎', 'suzuki', 'hashed_pass_1', 'suzuki@clinic.com', 2, 1), -- 看護師/管理者
('田中 花子', 'tanaka', 'hashed_pass_2', 'tanaka@clinic.com', 3, 2); -- 事務/一般

-- テスト日報
INSERT INTO "DIARY" (category_id, staff_id, title, content, target_date, is_urgent)
VALUES 
(2, 1, '酸素ボンベの在庫確認', 'B棟2階の残量が少ないようです。田中さん確認お願いします。', CURRENT_DATE, TRUE),
(3, 2, '来週の会議資料準備', '院長会議の資料を金曜日までに作成してください。', CURRENT_DATE, FALSE);

-- テストアクション（既読ステータス）
INSERT INTO "USER_DIARY_STATUS" (diary_id, staff_id, status)
VALUES 
(1, 2, 'UNREAD'), -- 田中さんはまだ見てない
(2, 1, 'CONFIRMED'); -- 鈴木さんは確認済み


-- =============================================
-- 7. マイグレーション用SQL（既存DBへの追加）
-- =============================================
-- ※新規でテーブルを作成する場合は不要です
-- ※既存のテーブルにカラムを追加する場合のみ使用

-- JOB_TYPEテーブルにis_activeカラムを追加
-- ALTER TABLE "JOB_TYPE" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;

-- DIARYテーブルに期限・解決者カラムを追加
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS deadline DATE;
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_by INT REFERENCES "STAFF"(staff_id);
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES "STAFF"(staff_id);

-- DIARYテーブルに掃除当番機能用カラムを追加
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS diary_type TEXT NOT NULL DEFAULT 'NORMAL';
-- ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS target_staff_id INT REFERENCES "STAFF"(staff_id);

-- 掃除当番割当テーブルを作成
-- CREATE TABLE IF NOT EXISTS "CLEANING_DUTY_ASSIGNMENT" (
--   duty_date DATE PRIMARY KEY,
--   staff_id INT NOT NULL REFERENCES "STAFF"(staff_id),
--   created_by INT REFERENCES "STAFF"(staff_id),
--   updated_by INT REFERENCES "STAFF"(staff_id),
--   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS "cleaning_duty_assignment_staff_id_idx"
--   ON "CLEANING_DUTY_ASSIGNMENT"(staff_id);

-- 掃除当番用カテゴリを追加
-- INSERT INTO "CATEGORY" (category_name, is_active)
-- SELECT '掃除当番', true
-- WHERE NOT EXISTS (
--   SELECT 1 FROM "CATEGORY" WHERE category_name = '掃除当番'
-- );

-- 掃除当番日報の一意制約
-- CREATE UNIQUE INDEX IF NOT EXISTS "diary_cleaning_duty_unique"
--   ON "DIARY"(target_date, diary_type)
--   WHERE diary_type = 'CLEANING_DUTY' AND parent_id IS NULL;

-- STAFFテーブルに非表示・削除フラグを追加
-- ALTER TABLE "STAFF" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false NOT NULL;
-- ALTER TABLE "STAFF" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;


-- =============================================
-- 8. ポイント設定（アプリ側で使用）
-- =============================================
-- 以下のポイント設定はアプリ側で管理されています：
--   確認した (CONFIRMED): 1ポイント
--   作業中 (WORKING): 5ポイント
--   解決済み (SOLVED): 10ポイント
--   返信投稿: 3ポイント
--   日報投稿: 2ポイント
--
-- ※ボタンをOFFにするとポイントは取り消されます
-- ※同じ記事で同じアクションは1回のみポイント付与
