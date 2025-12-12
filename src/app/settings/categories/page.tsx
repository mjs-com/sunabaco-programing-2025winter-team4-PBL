import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MasterEditList, MasterItem } from '@/components/settings/MasterEditList';
import { 
  getCategories, 
  saveCategory, 
  toggleCategoryStatus,
  getJobTypes,
  saveJobType,
  toggleJobTypeStatus
} from '@/app/actions/settings';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const [categories, jobTypes] = await Promise.all([
    getCategories(),
    getJobTypes()
  ]);

  // 型変換
  const categoryItems: MasterItem[] = (categories || []).map((c: any) => ({
    id: c.category_id,
    name: c.category_name,
    is_active: c.is_active
  }));

  const jobTypeItems: MasterItem[] = (jobTypes || []).map((j: any) => ({
    id: j.job_type_id,
    name: j.job_name,
    is_active: j.is_active
  }));

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/"
            className="flex items-center text-slate-600 hover:text-slate-800 -ml-2 p-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">カテゴリー設定</h1>
        </div>
        <p className="text-slate-500 mt-2">
          日報の分野やスタッフの職種カテゴリーを管理します。
          無効にすると新規作成時の選択肢には表示されなくなりますが、過去のデータは保持されます。
        </p>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2 items-start">
        <section>
          <MasterEditList 
            title="職種カテゴリー" 
            description="スタッフ登録時の職種選択肢を管理します。"
            items={jobTypeItems}
            onSave={saveJobType}
            onToggleStatus={toggleJobTypeStatus}
          />
        </section>

        <section>
          <MasterEditList 
            title="分野カテゴリー" 
            description="日報投稿時のカテゴリー選択肢を管理します。"
            items={categoryItems}
            onSave={saveCategory}
            onToggleStatus={toggleCategoryStatus}
          />
        </section>
      </div>
    </div>
  );
}
