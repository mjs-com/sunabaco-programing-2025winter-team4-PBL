erDiagram
    %% ユーザー管理
    STAFF {
        int staff_id PK
        string name
        int job_type_id FK
        int system_role_id FK
        string login_id
        string password_hash
        string email
        boolean is_active
        boolean is_hidden "非表示フラグ（産休などで一時的に非表示）"
        boolean is_deleted "削除フラグ（退職などで完全に削除、ただしデータは保持）"
        int current_points "キャッシュ用"
        string personal_color "パーソナルカラー（掃除当番カレンダー表示用）"
        datetime created_at
        datetime updated_at
    }

    JOB_TYPE {
        int job_type_id PK
        string job_name
        boolean is_active "論理削除用フラグ"
    }

    SYSTEM_ROLE {
        int role_id PK
        string role_name
    }

    %% 日報データ
    DIARY {
        bigint diary_id PK
        int parent_id FK "返信用自己参照"
        int category_id FK
        string title
        string content
        date target_date
        date deadline "期限日（任意）"
        string diary_type "NORMAL/CLEANING_DUTY"
        int target_staff_id FK "宛先（NULL=全体公開）"
        
        boolean is_urgent
        int bounty_points "特別報酬ポイント"
        
        boolean is_hidden
        boolean is_deleted
        int staff_id FK "作成者"
        int updated_by FK "最終編集者"
        int solved_by FK "解決者"
        datetime solved_at "解決日時"
        string current_status "UNREAD/CONFIRMED/WORKING/SOLVED"
        datetime created_at
        datetime updated_at
    }

    %% 掃除当番（1日=最大2人の割当）
    CLEANING_DUTY_ASSIGNMENT {
        date duty_date PK "複合主キー（duty_date, slot）"
        int slot PK "スロット番号（1 or 2）"
        int staff_id FK "当番者"
        int created_by FK
        int updated_by FK
        datetime created_at
        datetime updated_at
    }

    %% ユーザーの既読・作業状態
    USER_DIARY_STATUS {
        bigint id PK
        int staff_id FK
        bigint diary_id FK
        string status "UNREAD/CONFIRMED/WORKING/SOLVED"
        datetime updated_at
    }

    %% 行動ログ
    ACTION_LOG {
        bigint log_id PK
        int staff_id FK
        bigint diary_id FK
        string action_type "CONFIRM/WORKING/SOLVED/REPLY"
        int points_awarded
        datetime created_at
    }

    %% ポイント履歴
    POINT_LOG {
        bigint point_log_id PK
        int staff_id FK
        int amount "増減値（+10, -5など）"
        string reason
        datetime created_at
    }

    %% マスタ・タグ
    CATEGORY {
        int category_id PK
        string category_name
        boolean is_active
    }

    TAG {
        int tag_id PK
        string tag_name
        string css_class
        boolean is_active
    }

    DIARY_TAG {
        bigint id PK
        bigint diary_id FK
        int tag_id FK
    }

    %% リレーション
    JOB_TYPE ||--o{ STAFF : belongs_to
    SYSTEM_ROLE ||--o{ STAFF : has
    STAFF ||--o{ DIARY : creates
    STAFF ||--o{ DIARY : edits
    STAFF ||--o{ DIARY : solves
    STAFF ||--o{ DIARY : targets
    CATEGORY ||--o{ DIARY : category
    DIARY |o--o{ DIARY : reply
    DIARY ||--o{ DIARY_TAG : has
    TAG ||--o{ DIARY_TAG : used
    STAFF ||--o{ USER_DIARY_STATUS : status
    DIARY ||--o{ USER_DIARY_STATUS : tracked
    STAFF ||--o{ ACTION_LOG : performs
    DIARY ||--o{ ACTION_LOG : receives
    STAFF ||--o{ POINT_LOG : earns
    STAFF ||--o{ CLEANING_DUTY_ASSIGNMENT : assigned
