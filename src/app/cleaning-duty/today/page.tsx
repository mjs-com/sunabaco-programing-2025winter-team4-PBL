import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DiaryCard } from '@/components/diary/DiaryCard';
import { getCurrentStaff } from '@/app/actions/diary';
import { getMonthlyPoints } from '@/app/actions/points';
import { getOrCreateCleaningDutyDiary } from '@/app/actions/cleaningDuty';
import { toISODateString, getToday, formatDate } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function CleaningDutyTodayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params.date || toISODateString(getToday());

  const currentStaff = await getCurrentStaff();
  if (!currentStaff) {
    redirect('/login');
  }

  const isAdmin = currentStaff.system_role_id === 1;
  if (!isAdmin) {
    redirect('/');
  }

  const monthlyPoints = await getMonthlyPoints(currentStaff.staff_id);
  
  // DBにカラムが未導入の場合はエラーを握りつぶす
  let dutyDiary = null;
  try {
    dutyDiary = await getOrCreateCleaningDutyDiary(dateString);
  } catch (e) {
    console.warn('Cleaning duty feature not available:', e);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header currentPoints={monthlyPoints} systemRoleId={currentStaff.system_role_id} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">本日の掃除当番</h1>
            <p className="text-sm text-slate-500 mt-1">{formatDate(dateString)}</p>
          </div>
          <Link href="/">
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        {!dutyDiary ? (
          <Card>
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-lg">本日の掃除当番は未設定です</CardTitle>
            </CardHeader>
            <CardContent className="py-4 text-sm text-slate-600">
              「掃除当番カレンダー」から当番を設定してください。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ※ この日報は当番者本人にだけトップページで表示されます（管理者はここから確認できます）。
            </p>
            <DiaryCard
              diary={dutyDiary}
              currentUserId={currentStaff.staff_id}
              isAdmin={true}
              hideActions={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}

