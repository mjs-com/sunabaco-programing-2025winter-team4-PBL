'use client';

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DiaryList } from './DiaryList';
import { DiaryDetailModal } from './DiaryDetailModal';
import { updateUserDiaryStatus, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import type {
  DiaryWithRelations,
  UserStatus,
  DiaryStatus,
  Category,
  StaffBasicInfo,
  JobType,
} from '@/types/database.types';

/* ==============================
 * Server Action の戻り値型
 * ============================== */
type UpdateDiaryStatusResult =
  | {
    success: true;
    newUserStatus: UserStatus;
    newDiaryStatus: DiaryStatus;
  }
  | {
    success: false;
    error: string;
  };

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
  const [, startTransition] = useTransition();

  const [localDiaries, setLocalDiaries] = useState<DiaryWithRelations[]>(diaries);
  const [pendingStatusByDiaryId, setPendingStatusByDiaryId] =
    useState<Record<number, boolean>>({});
  const [selectedDiaryId, setSelectedDiaryId] = useState<number | null>(null);

  const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  /* ------------------------------
   * 初期データ取得
   * ------------------------------ */
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

  /* ------------------------------
   * 選択中の日報
   * ------------------------------ */
  const selectedDiary = useMemo(() => {
    if (selectedDiaryId == null) return null;
    return localDiaries.find(d => d.diary_id === selectedDiaryId) ?? null;
  }, [localDiaries, selectedDiaryId]);

  /* ------------------------------
   * ステータス変更（最終・型安全版）
   * ------------------------------ */
  const handleStatusChange = useCallback(
    async (diaryId: number, status: UserStatus) => {
      if (!currentUserId) {
        alert('ログインが必要です');
        return;
      }

      // 排他制御
      setPendingStatusByDiaryId(prev => {
        if (prev[diaryId]) return prev;
        return { ...prev, [diaryId]: true };
      });

      const nowIso = new Date().toISOString();
      const currentStaff = staffList.find(s => s.staff_id === currentUserId);

      let beforeDiary: DiaryWithRelations | null = null;
      let optimisticUserStatus: UserStatus = status;

      /* ---------- Optimistic Update ---------- */
      setLocalDiaries(prev =>
        prev.map(d => {
          if (d.diary_id !== diaryId) return d;

          beforeDiary = d;

          const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
          const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
          const prevStatus: UserStatus =
            idx >= 0 ? userStatuses[idx].status : 'UNREAD';

          const isToggleOff = prevStatus === status;
          optimisticUserStatus = isToggleOff ? 'UNREAD' : status;

          if (idx >= 0) {
            userStatuses[idx] = {
              ...userStatuses[idx],
              status: optimisticUserStatus,
              updated_at: nowIso,
            };
          } else {
            userStatuses.push({
              id: -Date.now(),
              diary_id: d.diary_id,
              staff_id: currentUserId,
              status: optimisticUserStatus,
              updated_at: nowIso,
              staff: currentStaff ?? {
                staff_id: currentUserId,
                name: currentUserName,
              },
            } as any);
          }

          let nextDiaryStatus: DiaryStatus = d.current_status;
          if (!isToggleOff && d.current_status !== 'SOLVED') {
            nextDiaryStatus = status as DiaryStatus;
          }
          if (status === 'SOLVED' && !isToggleOff) {
            nextDiaryStatus = 'SOLVED';
          }

          return {
            ...d,
            current_status: nextDiaryStatus,
            user_statuses: userStatuses,
          };
        })
      );

      /* ---------- Server Action ---------- */
      let result: UpdateDiaryStatusResult;

      try {
        result = (await updateUserDiaryStatus(
          diaryId,
          currentUserId,
          status
        )) as UpdateDiaryStatusResult;
      } catch (e) {
        console.error(e);
        result = { success: false, error: '通信エラーが発生しました' };
      }

      /* ---------- 結果反映 ---------- */
      if (!result.success && beforeDiary) {
        startTransition(() => {
          setLocalDiaries(prev =>
            prev.map(d => (d.diary_id === diaryId ? beforeDiary! : d))
          );
        });
        alert(`エラー: ${result.error}`);
      }

      if (result.success) {
        setLocalDiaries(prev =>
          prev.map(d => {
            if (d.diary_id !== diaryId) return d;

            const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
            const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);

            if (idx >= 0) {
              userStatuses[idx] = {
                ...userStatuses[idx],
                status: result.newUserStatus,
                updated_at: nowIso,
              };
            }

            return {
              ...d,
              current_status: result.newDiaryStatus,
              user_statuses: userStatuses,
            };
          })
        );
      }

      /* ---------- pending 即解除 ---------- */
      setPendingStatusByDiaryId(prev => {
        const next = { ...prev };
        delete next[diaryId];
        return next;
      });
    },
    [currentUserId, currentUserName, staffList]
  );

  /* ------------------------------
   * その他ハンドラ
   * ------------------------------ */
  const handleDiaryClick = useCallback((diaryId: number) => {
    setSelectedDiaryId(diaryId);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedDiaryId(null);
  }, []);

  const handleUpdate = useCallback(() => {
    router.refresh();
  }, [router]);

  /* ------------------------------
   * Render
   * ------------------------------ */
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
