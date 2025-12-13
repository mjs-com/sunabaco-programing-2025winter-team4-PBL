# クリニック日報アプリ

クリニックスタッフ向けの業務引き継ぎ・日報共有Webアプリケーションです。

## 技術スタック

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **UI**: Lucide React (アイコン)
- **Backend/DB**: Supabase (PostgreSQL, Auth)
- **Deployment**: Vercel

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. SQL Editorで `supabase_SQL指示文の例.md` の内容を実行してテーブルを作成

### 3. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を設定:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

SupabaseダッシュボードのSettings > API から値を取得してください。

### 4. Supabase Authの設定

1. Supabaseダッシュボードで Authentication > Providers を開く
2. Email providerが有効になっていることを確認
3. テストユーザーを作成（Authentication > Users > Add user）
   - 例: `suzuki@clinic.com` / 任意のパスワード

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   ├── actions/            # Server Actions
│   │   ├── auth.ts         # 認証関連
│   │   └── diary.ts        # 日報関連
│   ├── login/              # ログインページ
│   ├── post/               # 投稿ページ
│   ├── globals.css         # グローバルスタイル
│   ├── layout.tsx          # ルートレイアウト
│   └── page.tsx            # トップページ
├── components/             # Reactコンポーネント
│   ├── diary/              # 日報関連コンポーネント
│   │   ├── CategoryBadge.tsx
│   │   ├── DateNavigator.tsx
│   │   ├── DiaryCard.tsx
│   │   ├── DiaryList.tsx
│   │   ├── DiaryListClient.tsx
│   │   ├── FloatingActionButton.tsx
│   │   ├── StatusBadge.tsx
│   │   └── UserInitial.tsx
│   ├── layout/             # レイアウトコンポーネント
│   │   └── Header.tsx
│   └── ui/                 # 汎用UIコンポーネント
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Switch.tsx
│       └── Textarea.tsx
├── lib/                    # ライブラリ・ユーティリティ
│   ├── supabase/           # Supabaseクライアント
│   │   ├── client.ts       # ブラウザ用
│   │   ├── middleware.ts   # ミドルウェア用
│   │   └── server.ts       # サーバー用
│   └── utils.ts            # ユーティリティ関数
├── types/                  # TypeScript型定義
│   └── database.types.ts
└── middleware.ts           # Next.jsミドルウェア
```

## 主な機能

### Phase 1 (MVP)

- [x] ユーザー認証（ログイン/ログアウト）
- [x] 日報一覧表示（日付別）
- [x] 日報投稿
- [x] ステータス更新（確認/作業中/解決）
- [x] ポイントシステム

### Phase 2（今後の予定）

- [ ] 至急フィルター
- [ ] やることリスト
- [ ] 返信機能
- [ ] プッシュ通知

## デプロイ

Vercelにデプロイする場合:

1. GitHubリポジトリにプッシュ
2. Vercelでプロジェクトをインポート
3. 環境変数を設定
4. デプロイ

## ライセンス

Private - チーム内部使用のみ

<!-- Test preview deployment -->
