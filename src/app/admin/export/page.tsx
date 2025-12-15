import { Header } from '@/components/layout/Header';
import { ExportForm } from '@/components/admin/ExportForm';
import { getCurrentStaff } from '@/app/actions/diary';
import { redirect } from 'next/navigation';

export default async function ExportPage() {
  // 管理者権限チェック
  const currentStaff = await getCurrentStaff();
  
  if (!currentStaff) {
    redirect('/login');
  }

  // 管理者でない場合はトップページへリダイレクト
  if (currentStaff.system_role_id !== 1) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header 
        currentPoints={currentStaff.current_points || 0}
        systemRoleId={currentStaff.system_role_id}
      />
      
      <main className="container mx-auto px-4 py-6">
        <ExportForm />
      </main>
    </div>
  );
}
