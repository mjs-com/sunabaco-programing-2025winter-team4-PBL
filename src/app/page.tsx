import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { DateNavigator } from '@/components/diary/DateNavigator';
import { FloatingActionButton } from '@/components/diary/FloatingActionButton';
import { getDiariesByDate, getCurrentStaff, getCategories, searchDiaries } from '@/app/actions/diary';
import { getMonthlyPoints } from '@/app/actions/points';
import { toISODateString, getToday } from '@/lib/utils';
import { DiaryListClient } from '@/components/diary/DiaryListClient';
import { getCleaningDutyDiaryForStaff } from '@/app/actions/cleaningDuty';

interface PageProps {
  searchParams: Promise<{ date?: string; filter?: 'urgent' | 'todo'; sort?: 'asc' | 'desc'; search?: string; from?: string; to?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // 日付パラメータがない場合は今日の日付を使用
  const todayString = toISODateString(getToday());
  const dateString = params.date || todayString;
  const currentDate = new Date(dateString + 'T00:00:00');
  const filter = params.filter;
  const isToday = dateString === todayString;
  
  // 検索パラメータ
  const searchKeyword = params.search;
  const searchFrom = params.from;
  const searchTo = params.to;
  const isSearchMode = !!searchKeyword;

  // ソート順の決定（TODO/至急の場合はデフォルトで古い順(asc)）
  let sortOrder = params.sort;
  if (!sortOrder && (filter === 'todo' || filter === 'urgent')) {
    sortOrder = 'asc';
  }

  // データ取得
  console.log('Fetching data for date:', dateString, 'filter:', filter, 'sort:', sortOrder, 'search:', searchKeyword);
  
  try {
    // 先にスタッフ情報を取得
    const currentStaff = await getCurrentStaff();
    
    // TODOフィルターの場合はスタッフ情報を使用
    const jobTypeName = currentStaff?.job_type?.job_name;
    const staffName = currentStaff?.name;
    
    // 今月のポイントを取得
    const monthlyPoints = currentStaff?.staff_id 
      ? await getMonthlyPoints(currentStaff.staff_id) 
      : 0;

    // 検索モードの場合は検索結果を取得、それ以外は日付で取得
    const [diaries, categories] = await Promise.all([
      isSearchMode
        ? searchDiaries(searchKeyword, searchFrom, searchTo, currentStaff?.staff_id)
        : getDiariesByDate(dateString, filter, currentStaff?.staff_id, jobTypeName, staffName, sortOrder),
      getCategories(),
    ]);

    // 本日の掃除当番（当番者のみに表示）- 検索モードでは表示しない
    // ※ DBにカラムが未導入の場合はエラーを握りつぶして null のまま続行
    let cleaningDutyDiary = null;
    if (!isSearchMode && isToday && currentStaff?.staff_id) {
      try {
        cleaningDutyDiary = await getCleaningDutyDiaryForStaff(dateString, currentStaff.staff_id);
      } catch (e) {
        console.warn('Cleaning duty feature not available:', e);
      }
    }

    const mergedDiaries = cleaningDutyDiary
      ? [cleaningDutyDiary, ...(diaries || []).filter(d => d.diary_id !== cleaningDutyDiary.diary_id)]
      : (diaries || []);
    
    console.log('Data fetched successfully', { 
      diariesCount: diaries?.length, 
      staffFound: !!currentStaff,
      monthlyPoints,
      isSearchMode
    });

    return (
      <div className="min-h-screen bg-slate-50">
        <Header 
          currentPoints={monthlyPoints}
          systemRoleId={currentStaff?.system_role_id}
        />
        <Suspense fallback={<div className="sticky top-14 z-40 bg-slate-50 border-b border-slate-200 h-14" />}>
          <DateNavigator currentDate={currentDate} />
        </Suspense>

        <main className="container mx-auto px-4 py-6 pb-24">
          <DiaryListClient
            diaries={mergedDiaries}
            currentUserId={currentStaff?.staff_id}
            currentUserName={currentStaff?.name}
            isAdmin={currentStaff?.system_role_id === 1}
            categories={categories || []}
          />
        </main>

        <FloatingActionButton href="/post" />
      </div>
    );
  } catch (error) {
    console.error('Error fetching data:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">データの読み込み中にエラーが発生しました</p>
          <p className="text-sm text-slate-500">{String(error)}</p>
        </div>
      </div>
    );
  }
}

