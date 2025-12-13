'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DiaryList } from './DiaryList';
import { DiaryDetailModal } from './DiaryDetailModal';
import { updateUserDiaryStatus, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import type {
  DiaryWithRelations,
  UserStatus,
  Category,
  StaffBasicInfo,
  JobType,
} from '@/types/database.types';

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

  const selectedDiary = useMemo(() => {
    if (selectedDiaryId == null) return null;
    return localDiaries.find(d => d.diary_id === selectedDiaryId) ?? null;
  }, [localDiaries, selectedDiaryId]);

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

      const before = localDiaries;
      const target = localDiaries.find(d => d.diary_id === diaryId);
      const prevUserStatus = target?.user_statuses?.find(us => us.staff_id === currentUserId)?.status ?? 'UNREAD';
      const isToggleOff = prevUserStatus === status;
      const optimisticUserStatus: UserStatus = isToggleOff ? 'UNREAD' : status;

      const currentStaff = staffList.find(s => s.staff_id === currentUserId);

      setLocalDiaries(prev =>
        prev.map(d => {
          if (d.diary_id !== diaryId) return d;

          const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
          const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
          const nowIso = new Date().toISOString();

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
        })
      );

      startTransition(async () => {
        try {
          const result = await updateUserDiaryStatus(diaryId, currentUserId, status);
          if (!result?.success) {
            setLocalDiaries(before);
            alert(`エラー: ${result?.error || 'ステータス更新に失敗しました'}`);
            return;
          }

          setLocalDiaries(prev =>
            prev.map(d => {
              if (d.diary_id !== diaryId) return d;
              const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
              const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
              const nowIso = new Date().toISOString();
              const serverUserStatus = (result.newUserStatus || optimisticUserStatus) as UserStatus;
              if (idx >= 0) {
                userStatuses[idx] = {
                  ...userStatuses[idx],
                  status: serverUserStatus,
                  updated_at: nowIso,
                } as any;
              }
              return {
                ...d,
                current_status: (result.newDiaryStatus ? (result.newDiaryStatus as any) : d.current_status),
                user_statuses: userStatuses,
              } as any;
            })
          );
        } catch (e) {
          console.error(e);
          setLocalDiaries(before);
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
    [currentUserId, currentUserName, staffList, localDiaries, pendingStatusByDiaryId]
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

/* --- 旧バージョンの handleStatusChange（クールダウンとディレイあり）をコメントアウトで保存 ---
const [lastClickTimeByDiaryId, setLastClickTimeByDiaryId] = useState<Record<number, number>>({});

const handleStatusChange = useCallback(
  (diaryId: number, status: UserStatus) => {
    if (!currentUserId) {
      alert('ログインが必要です');
      return;
    }

    const now = Date.now();
    const lastClickTime = lastClickTimeByDiaryId[diaryId] || 0;
    const COOLDOWN_MS = 1000;

    if (now - lastClickTime < COOLDOWN_MS) {
      return;
    }

    setLastClickTimeByDiaryId(prev => ({ ...prev, [diaryId]: now }));

    const UI_DELAY_MS = 120;
    setTimeout(() => {
      // ...（中略：現在の handleStatusChange と同様の処理）
    }, UI_DELAY_MS);
  },
  [currentUserId, currentUserName, staffList, localDiaries, lastClickTimeByDiaryId]
);
*/