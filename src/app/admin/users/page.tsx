import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getAllStaffForManagement } from '@/app/actions/admin';
import { getCurrentStaff } from '@/app/actions/diary';
import { redirect } from 'next/navigation';
import { UserManagementList } from '@/components/admin/UserManagementList';
import { Users, Info } from 'lucide-react';

export default async function UserManagementPage() {
  // 管理者権限チェック
  const currentStaff = await getCurrentStaff();
  
  if (!currentStaff) {
    redirect('/login');
  }

  // 管理者でない場合はトップページへリダイレクト
  if (currentStaff.system_role_id !== 1) {
    redirect('/');
  }

  // 全スタッフ一覧を取得（削除されていないもののみ）
  const staffList = await getAllStaffForManagement();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header 
        currentPoints={currentStaff.current_points || 0}
        systemRoleId={currentStaff.system_role_id}
      />
      
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary-600" />
              <CardTitle className="text-2xl">ユーザー管理</CardTitle>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              現在のアクティブユーザー一覧
            </p>
          </CardHeader>
          
          <CardContent>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">使い方：</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <strong>非表示</strong>：産休などで一時的に休職するユーザーを非表示にします。
                      メンションや確認済み・解決済みバッチの宛先から除外されますが、ユーザー管理画面には表示されます。
                    </li>
                    <li>
                      <strong>削除</strong>：退職などで今後復帰の見込みがないユーザーを削除します。
                      ユーザー管理画面からも非表示になりますが、過去記事では名前が表示されます。
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <UserManagementList staffList={staffList} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
