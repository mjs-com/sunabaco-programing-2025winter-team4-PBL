'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DiaryList } from './DiaryList';
import { DiaryDetailModal } from './DiaryDetailModal';
import { updateUserDiaryStatus, getJobTypes, getAllUnsolvedDiaries } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import { Button } from '@/components/ui/Button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type {
  DiaryWithRelations,
  UserStatus,
  Category,
  StaffBasicInfo,
  JobType,
} from '@/types/database.types';

// 旧: 即時にUI反映していたが、反応が早すぎるとの指摘により微小ディレイを追加
// const STATUS_UI_DELAY_MS = 0;
const STATUS_UI_DELAY_MS = 60; // ms 単位の遅延

interface DiaryListClientProps {
  diaries: DiaryWithRelations[];
  currentUserId?: number;
  currentUserName?: string;
  isAdmin?: boolean;
  categories: Category[];
}

export function DiaryListClient({
  diaries,
  currentUserId,
  currentUserName,
  isAdmin,
  categories,
}: DiaryListClientProps) {
  const router = useRouter();
  const [pendingStatusByDiaryId, setPendingStatusByDiaryId] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [selectedDiaryId, setSelectedDiaryId] = useState<number | null>(null);
  const [localDiaries, setLocalDiaries] = useState<DiaryWithRelations[]>(diaries);
  const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  // 未解決記事表示用ステート
  const [showAllUnsolved, setShowAllUnsolved] = useState(false);
  const [unsolvedDiaries, setUnsolvedDiaries] = useState<DiaryWithRelations[]>([]);
  const [isLoadingUnsolved, setIsLoadingUnsolved] = useState(false);

  useEffect(() => {
    Promise.all([getActiveStaff(), getJobTypes()])
    .then(([staff, jobs]) => {
      setStaffList(staff);
      setJobTypes(jobs);
    })
    .catch(console.error);
  }, []);

  useEffect(() => {
    setLocalDiaries(diaries);
  }, [diaries]);

  // 未解決記事を表示するトグル関数
  const toggleUnsolvedDiaries = useCallback(async () => {
    const nextState = !showAllUnsolved;
    setShowAllUnsolved(nextState);

    if (nextState && unsolvedDiaries.length === 0) {
      setIsLoadingUnsolved(true);
      try {
        const data = await getAllUnsolvedDiaries(currentUserId);
        // 本日の記事（localDiaries）に含まれているものは除外する（IDで重複チェック）
        const currentIds = new Set(localDiaries.map(d => d.diary_id));
        const filtered = data.filter(d => !currentIds.has(d.diary_id));
        setUnsolvedDiaries(filtered);
      } catch (error) {
        console.error('Error fetching unsolved diaries:', error);
        alert('未解決記事の取得に失敗しました');
      } finally {
        setIsLoadingUnsolved(false);
      }
    }
  }, [showAllUnsolved, unsolvedDiaries.length, currentUserId, localDiaries]);

  const selectedDiary = useMemo(() => {
    if (selectedDiaryId == null) return null;
    // localDiaries または unsolvedDiaries から検索
    return localDiaries.find(d => d.diary_id === selectedDiaryId) ?? 
           unsolvedDiaries.find(d => d.diary_id === selectedDiaryId) ?? null;
  }, [localDiaries, unsolvedDiaries, selectedDiaryId]);

  const handleStatusChange = useCallback(
    (diaryId: number, status: UserStatus) => {
      if (!currentUserId) {
        alert('ログインが必要です');
        return;
      }

      if (pendingStatusByDiaryId[diaryId]) {
        return;
      }

      setPendingStatusByDiaryId(prev => ({ ...prev, [diaryId]: true }));

      // 更新前の状態を保持（ロールバック用）
      const beforeLocal = localDiaries;
      const beforeUnsolved = unsolvedDiaries;

      // 対象の日記を探す
      const targetLocal = localDiaries.find(d => d.diary_id === diaryId);
      const targetUnsolved = unsolvedDiaries.find(d => d.diary_id === diaryId);
      const target = targetLocal || targetUnsolved;

      const prevUserStatus = target?.user_statuses?.find(us => us.staff_id === currentUserId)?.status ?? 'UNREAD';
      const isToggleOff = prevUserStatus === status;
      const optimisticUserStatus: UserStatus = isToggleOff ? 'UNREAD' : status;

      const currentStaff = staffList.find(s => s.staff_id === currentUserId);

      // リスト更新用の共通関数
      const updateList = (list: DiaryWithRelations[], serverResult?: any) => {
        return list.map(d => {
          if (d.diary_id !== diaryId) return d;

          const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
          const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
          const nowIso = new Date().toISOString();

          // サーバー結果がある場合（完了後）
          if (serverResult) {
            const serverUserStatus = (serverResult.newUserStatus || optimisticUserStatus) as UserStatus;
            if (idx >= 0) {
              userStatuses[idx] = {
                ...userStatuses[idx],
                status: serverUserStatus,
                updated_at: nowIso,
              } as any;
            }
            return {
              ...d,
              current_status: (serverResult.newDiaryStatus ? (serverResult.newDiaryStatus as any) : d.current_status),
              user_statuses: userStatuses,
            } as any;
          }

          // 楽観的更新の場合
          if (idx >= 0) {
            userStatuses[idx] = {
              ...userStatuses[idx],
              status: optimisticUserStatus,
              updated_at: nowIso,
              staff:
                userStatuses[idx].staff ??
                (currentStaff as any) ??
                (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
            } as any;
          } else {
            userStatuses.push({
              id: -Date.now(),
              diary_id: d.diary_id,
              staff_id: currentUserId,
              status: optimisticUserStatus,
              updated_at: nowIso,
              staff:
                (currentStaff as any) ??
                (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
            } as any);
          }

          let nextDiaryStatus = d.current_status;
          if (!isToggleOff && d.current_status !== 'SOLVED') {
            nextDiaryStatus = status as any;
          }
          if (status === 'SOLVED' && !isToggleOff) {
            nextDiaryStatus = 'SOLVED' as any;
          }

          return {
            ...d,
            current_status: nextDiaryStatus,
            user_statuses: userStatuses,
          } as any;
        });
      };

      // 楽観的更新を実行
      setLocalDiaries(prev => updateList(prev));
      setUnsolvedDiaries(prev => updateList(prev));

      startTransition(async () => {
        try {
          const result = await updateUserDiaryStatus(diaryId, currentUserId, status);
          if (!result?.success) {
            // エラー時はロールバック
            setLocalDiaries(beforeLocal);
            setUnsolvedDiaries(beforeUnsolved);
            alert(`エラー: ${result?.error || 'ステータス更新に失敗しました'}`);
            return;
          }

          // サーバー完了後の更新（確定値をセット）
          setLocalDiaries(prev => updateList(prev, result));
          setUnsolvedDiaries(prev => updateList(prev, result));

        } catch (e) {
          console.error(e);
          setLocalDiaries(beforeLocal);
          setUnsolvedDiaries(beforeUnsolved);
          alert('エラー: ステータス更新に失敗しました');
        } finally {
          setPendingStatusByDiaryId(prev => {
            const next = { ...prev };
            delete next[diaryId];
            return next;
          });
        }
      });
    },
    [currentUserId, currentUserName, staffList, localDiaries, unsolvedDiaries, pendingStatusByDiaryId]
  );

  const handleDiaryClick = useCallback((diaryId: number) => {
    setSelectedDiaryId(diaryId);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedDiaryId(null);
  }, []);

  const handleUpdate = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <DiaryList
        diaries={localDiaries}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isAdmin={isAdmin}
        allStaff={staffList}
        jobTypes={jobTypes}
        onStatusChange={handleStatusChange}
        onDiaryClick={handleDiaryClick}
        onUpdate={handleUpdate}
        pendingStatusByDiaryId={pendingStatusByDiaryId}
      />

      {/* 未解決記事すべてを表示するボタンエリア */}
      <div className="mt-8 mb-8 text-center">
        <Button
          onClick={toggleUnsolvedDiaries}
          variant="outline"
          className="w-full sm:w-auto min-w-[300px] border-dashed border-2 py-6 text-slate-600 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-all"
        >
          {showAllUnsolved ? (
            <>
              <ChevronUp className="mr-2 h-5 w-5" />
              未解決の記事を隠す
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-5 w-5" />
              未解決の記事すべてを表示する
            </>
          )}
        </Button>
      </div>

      {/* 未解決記事リスト */}
      {showAllUnsolved && (
        <div className="mt-4 mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-4 px-2">
            <h2 className="text-lg font-bold text-slate-700">未解決の記事一覧（過去分含む）</h2>
            <span className="text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {isLoadingUnsolved ? '読み込み中...' : `${unsolvedDiaries.length}件`}
            </span>
          </div>
          
          {isLoadingUnsolved ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <DiaryList
              diaries={unsolvedDiaries}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              allStaff={staffList}
              jobTypes={jobTypes}
              onStatusChange={handleStatusChange}
              onDiaryClick={handleDiaryClick}
              onUpdate={() => {
                handleUpdate();
                // 画面全体のリフレッシュで対応（未解決リストの再取得は必須ではないが、整合性のためには本来望ましい）
              }}
              pendingStatusByDiaryId={pendingStatusByDiaryId}
            />
          )}
          
          {/* 下部にも閉じるボタン */}
          {!isLoadingUnsolved && unsolvedDiaries.length > 5 && (
            <div className="mt-6 text-center">
              <Button
                onClick={() => setShowAllUnsolved(false)}
                variant="ghost"
                className="text-slate-500"
              >
                <ChevronUp className="mr-2 h-4 w-4" />
                閉じる
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedDiary && (
        <DiaryDetailModal
          diary={selectedDiary}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          categories={categories}
          staffList={staffList}
          jobTypes={jobTypes}
          onClose={handleModalClose}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}