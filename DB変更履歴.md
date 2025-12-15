# データベース変更履歴

## 2025-12-12 - DIARYテーブルに期限・解決者カラム追加

**変更日時**: 2025-12-12  
**変更内容**: 期限管理と解決者追跡のため、DIARYテーブルにカラムを追加

**SQL文**:
```sql
-- 期限カラム
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS deadline DATE;

-- 解決者カラム
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_by INT REFERENCES "STAFF"(staff_id);

-- 解決日時カラム
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS solved_at TIMESTAMP WITH TIME ZONE;

-- 編集者カラム（既存）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES "STAFF"(staff_id);
```

**変更理由**:
- `deadline`: 期限による枠線色分け（3日前から黄色、当日以降は赤）
- `solved_by`: 解決者のフルネーム表示
- `solved_at`: 解決日時の表示
- `updated_by`: 編集者の記録

**影響範囲**:
- `DIARY`テーブル
- 日報一覧表示（枠線の色分け）
- 解決済み表示（解決者名とタイムスタンプ）
- 日報編集機能

**注意事項**:
- 既存のレコードでは新カラムはNULLになります
- `deadline`は任意項目（設定しなくても投稿可能）
- `solved_by`と`solved_at`は解決ボタン押下時に自動設定

## 2025-12-12 - JOB_TYPEテーブルに論理削除用フラグ追加

**変更日時**: 2025-12-12  
**変更内容**: 職種（JOB_TYPE）の論理削除を可能にするため、is_activeカラムを追加

**SQL文**:
```sql
ALTER TABLE "JOB_TYPE" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
```

**変更理由**:
- 職種カテゴリーの編集画面にて、使用しなくなった職種を削除（無効化）できるようにするため。
- CATEGORYテーブルには既にis_activeが存在するため、JOB_TYPEにも合わせる。

**影響範囲**:
- `JOB_TYPE`テーブル
- 職種一覧の取得処理（is_active=trueのみ取得するように変更が必要）

## 2025-12-12 - 掃除当番機能追加

**変更日時**: 2025-12-12  
**変更内容**: 掃除当番機能のため、DIARYテーブルにカラムを追加し、CLEANING_DUTY_ASSIGNMENTテーブルを新規作成

**SQL文**:
```sql
-- 日報の種別（通常/掃除当番など）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS diary_type TEXT NOT NULL DEFAULT 'NORMAL';

-- 日報の宛先（NULL=全体公開、値あり=指定スタッフのみ表示）
ALTER TABLE "DIARY" ADD COLUMN IF NOT EXISTS target_staff_id INT REFERENCES "STAFF"(staff_id);

-- 掃除当番の割当テーブル（1日=1人）
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

-- 掃除当番用カテゴリ（なければ追加）
INSERT INTO "CATEGORY" (category_name, is_active)
SELECT '掃除当番', true
WHERE NOT EXISTS (
  SELECT 1 FROM "CATEGORY" WHERE category_name = '掃除当番'
);

-- 掃除当番日報は「日付×種別」で一意（返信は除外）
CREATE UNIQUE INDEX IF NOT EXISTS "diary_cleaning_duty_unique"
  ON "DIARY"(target_date, diary_type)
  WHERE diary_type = 'CLEANING_DUTY' AND parent_id IS NULL;
```

**変更理由**:
- `diary_type`: 日報の種別を区別（通常日報と掃除当番日報を分離）
- `target_staff_id`: 特定のスタッフのみに表示する日報を実現（掃除当番は当番者のみに表示）
- `CLEANING_DUTY_ASSIGNMENT`: 掃除当番の割当を管理（1日につき1人の当番者を記録）

**影響範囲**:
- `DIARY`テーブル（新カラム追加）
- `CLEANING_DUTY_ASSIGNMENT`テーブル（新規作成）
- `CATEGORY`テーブル（「掃除当番」カテゴリの追加）
- 日報一覧表示（`target_staff_id`によるフィルタリング）
- 掃除当番カレンダー機能
- 掃除当番日報の自動生成機能

**注意事項**:
- `diary_type`のデフォルト値は`'NORMAL'`（既存レコードは自動的に`'NORMAL'`になる）
- `target_staff_id`がNULLの場合は全体公開（従来通りの動作）
- 掃除当番機能を使用しない場合は、これらのカラム/テーブルは未適用でもアプリは動作します（コード側でエラーハンドリング済み）

## 2025-12-15 - STAFFテーブルに非表示・削除フラグ追加

**変更日時**: 2025-12-15  
**変更内容**: ユーザー管理機能のため、STAFFテーブルに`is_hidden`と`is_deleted`カラムを追加

**SQL文**:
```sql
-- 非表示フラグ（産休などで一時的に非表示にする場合）
ALTER TABLE "STAFF" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false NOT NULL;

-- 削除フラグ（退職などで完全に削除する場合、ただしデータは保持）
ALTER TABLE "STAFF" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
```

**変更理由**:
- `is_hidden`: 産休などで一時的に休職するユーザーを非表示にする（メンションやバッチの宛先から除外、ただしユーザー管理画面には表示）
- `is_deleted`: 退職などで今後復帰の見込みがないユーザーを削除する（ユーザー管理画面にも表示されない、ただし過去記事では名前が表示される）

**影響範囲**:
- `STAFF`テーブル（新カラム追加）
- メンション機能（`getActiveStaff()`で`is_hidden=false`かつ`is_deleted=false`のみ取得）
- 確認済み・解決済みバッチ（非表示ユーザーは除外）
- ユーザー管理画面（全スタッフ一覧、非表示/削除の切り替え機能）

**注意事項**:
- 既存のレコードでは新カラムは`false`になります
- `is_deleted=true`のユーザーは過去記事では名前が表示されます（JOINで取得するため）
- `is_hidden=true`のユーザーはユーザー管理画面には表示されますが、メンションやバッチの宛先からは除外されます
