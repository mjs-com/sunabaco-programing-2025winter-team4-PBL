'use client';

import { useEffect, useState } from 'react';
import { DiaryList } from './DiaryList';
import { DiaryDetailModal } from './DiaryDetailModal';
import { updateUserDiaryStatus, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import type { DiaryWithRelations, UserStatus, Category, StaffWithRelations, JobType } from '@/types/database.types';
import { useRouter } from 'next/navigation';

interface DiaryListClientProps {
  diaries: DiaryWithRelations[];
  currentUserId?: number;
  currentUserName?: string;
  isAdmin?: boolean;
  categories: Category[];
}

export function DiaryListClient({ diaries, currentUserId, currentUserName, isAdmin, categories }: DiaryListClientProps) {
  const router = useRouter();
  const [localDiaries, setLocalDiaries] = useState<DiaryWithRelations[]>(diaries);
  const [pendingStatusByDiaryId, setPendingStatusByDiaryId] = useState<Record<number, boolean>>({});
  const [selectedDiary, setSelectedDiary] = useState<DiaryWithRelations | null>(null);
  const [staffList, setStaffList] = useState<StaffWithRelations[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  useEffect(() => {
    getActiveStaff().then(setStaffList).catch(console.error);
    getJobTypes().then(setJobTypes).catch(console.error);
  }, []);

  // サーバー側から渡された日報一覧が更新されたらローカル状態も同期
  useEffect(() => {
    setLocalDiaries(diaries);
  }, [diaries]);

  // 詳細モーダルを開いている場合、一覧更新に追従
  useEffect(() => {
    if (!selectedDiary) return;
    const updated = localDiaries.find(d => d.diary_id === selectedDiary.diary_id);
    if (updated) setSelectedDiary(updated);
  }, [localDiaries, selectedDiary]);

  const handleStatusChange = (diaryId: number, status: UserStatus) => {
    if (!currentUserId) {
      alert('ログインが必要です');
      return;
    }

    const before = localDiaries;
    const target = localDiaries.find(d => d.diary_id === diaryId);
    const prevUserStatus = target?.user_statuses?.find(us => us.staff_id === currentUserId)?.status ?? 'UNREAD';
    const isToggleOff = prevUserStatus === status;
    const optimisticUserStatus: UserStatus = isToggleOff ? 'UNREAD' : status;

    const currentStaff = staffList.find(s => s.staff_id === currentUserId);

    // まずUIを即時更新（体感速度改善）
    setPendingStatusByDiaryId(prev => ({ ...prev, [diaryId]: true }));
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
            staff: userStatuses[idx].staff ?? (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
          };
        } else {
          userStatuses.push({
            id: -Date.now(),
            diary_id: d.diary_id,
            staff_id: currentUserId,
            status: optimisticUserStatus,
            updated_at: nowIso,
            staff: (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
          } as any);
        }

        // DIARY側のcurrent_statusは「ONにした場合のみ」追従（OFF時はサーバー側も更新しないケースがあるため）
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
        };
      })
    );

    // サーバーに反映
    updateUserDiaryStatus(diaryId, currentUserId, status)
      .then((result) => {
        if (!result?.success) {
          setLocalDiaries(before);
          alert(`エラー: ${result?.error || 'ステータス更新に失敗しました'}`);
          return;
        }

        // サーバーの結果で確定（特にSOLVED解除時のDIARYステータス）
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
                staff: userStatuses[idx].staff ?? (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
              };
            }

            return {
              ...d,
              current_status: (result.newDiaryStatus ? (result.newDiaryStatus as any) : d.current_status),
              user_statuses: userStatuses,
            };
          })
        );
      })
      .catch((e) => {
        console.error(e);
        setLocalDiaries(before);
        alert('エラー: ステータス更新に失敗しました');
      })
      .finally(() => {
        setPendingStatusByDiaryId(prev => {
          const next = { ...prev };
          delete next[diaryId];
          return next;
        });
      });
  };

  const handleDiaryClick = (diary: DiaryWithRelations) => {
    setSelectedDiary(diary);
  };

  const handleModalClose = () => {
    setSelectedDiary(null);
  };

  const handleUpdate = () => {
    router.refresh();
  };

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

