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
