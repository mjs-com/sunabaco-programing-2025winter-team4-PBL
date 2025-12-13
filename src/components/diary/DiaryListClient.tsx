// 'use client';

// import { useEffect, useState } from 'react';
// import { DiaryList } from './DiaryList';
// import { DiaryDetailModal } from './DiaryDetailModal';
// import { updateUserDiaryStatus, getJobTypes } from '@/app/actions/diary';
// import { getActiveStaff } from '@/app/actions/staff';
// import type { DiaryWithRelations, UserStatus, Category, StaffBasicInfo, JobType } from '@/types/database.types';
// import { useRouter } from 'next/navigation';

// interface DiaryListClientProps {
//   diaries: DiaryWithRelations[];
//   currentUserId?: number;
//   currentUserName?: string;
//   isAdmin?: boolean;
//   categories: Category[];
// }

// export function DiaryListClient({ diaries, currentUserId, currentUserName, isAdmin, categories }: DiaryListClientProps) {
//   const router = useRouter();
//   const [localDiaries, setLocalDiaries] = useState<DiaryWithRelations[]>(diaries);
//   const [pendingStatusByDiaryId, setPendingStatusByDiaryId] = useState<Record<number, boolean>>({});
//   const [selectedDiary, setSelectedDiary] = useState<DiaryWithRelations | null>(null);
//   const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);
//   const [jobTypes, setJobTypes] = useState<JobType[]>([]);

//   useEffect(() => {
//     getActiveStaff().then(setStaffList).catch(console.error);
//     getJobTypes().then(setJobTypes).catch(console.error);
//   }, []);

//   // サーバー側から渡された日報一覧が更新されたらローカル状態も同期
//   useEffect(() => {
//     setLocalDiaries(diaries);
//   }, [diaries]);

//   // 詳細モーダルを開いている場合、一覧更新に追従
//   useEffect(() => {
//     if (!selectedDiary) return;
//     const updated = localDiaries.find(d => d.diary_id === selectedDiary.diary_id);
//     if (updated) setSelectedDiary(updated);
//   }, [localDiaries, selectedDiary]);

//   const handleStatusChange = (diaryId: number, status: UserStatus) => {
//     if (!currentUserId) {
//       alert('ログインが必要です');
//       return;
//     }

//     const before = localDiaries;
//     const target = localDiaries.find(d => d.diary_id === diaryId);
//     const prevUserStatus = target?.user_statuses?.find(us => us.staff_id === currentUserId)?.status ?? 'UNREAD';
//     const isToggleOff = prevUserStatus === status;
//     const optimisticUserStatus: UserStatus = isToggleOff ? 'UNREAD' : status;

//     const currentStaff = staffList.find(s => s.staff_id === currentUserId);

//     // まずUIを即時更新（体感速度改善）
//     setPendingStatusByDiaryId(prev => ({ ...prev, [diaryId]: true }));
//     setLocalDiaries(prev =>
//       prev.map(d => {
//         if (d.diary_id !== diaryId) return d;

//         const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
//         const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
//         const nowIso = new Date().toISOString();

//         if (idx >= 0) {
//           userStatuses[idx] = {
//             ...userStatuses[idx],
//             status: optimisticUserStatus,
//             updated_at: nowIso,
//             staff: userStatuses[idx].staff ?? (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
//           };
//         } else {
//           userStatuses.push({
//             id: -Date.now(),
//             diary_id: d.diary_id,
//             staff_id: currentUserId,
//             status: optimisticUserStatus,
//             updated_at: nowIso,
//             staff: (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
//           } as any);
//         }

//         // DIARY側のcurrent_statusは「ONにした場合のみ」追従（OFF時はサーバー側も更新しないケースがあるため）
//         let nextDiaryStatus = d.current_status;
//         if (!isToggleOff && d.current_status !== 'SOLVED') {
//           nextDiaryStatus = status as any;
//         }
//         if (status === 'SOLVED' && !isToggleOff) {
//           nextDiaryStatus = 'SOLVED' as any;
//         }

//         return {
//           ...d,
//           current_status: nextDiaryStatus,
//           user_statuses: userStatuses,
//         };
//       })
//     );

//     // サーバーに反映
//     updateUserDiaryStatus(diaryId, currentUserId, status)
//       .then((result) => {
//         if (!result?.success) {
//           setLocalDiaries(before);
//           alert(`エラー: ${result?.error || 'ステータス更新に失敗しました'}`);
//           return;
//         }

//         // サーバーの結果で確定（特にSOLVED解除時のDIARYステータス）
//         setLocalDiaries(prev =>
//           prev.map(d => {
//             if (d.diary_id !== diaryId) return d;

//             const userStatuses = d.user_statuses ? [...d.user_statuses] : [];
//             const idx = userStatuses.findIndex(us => us.staff_id === currentUserId);
//             const nowIso = new Date().toISOString();
//             const serverUserStatus = (result.newUserStatus || optimisticUserStatus) as UserStatus;

//             if (idx >= 0) {
//               userStatuses[idx] = {
//                 ...userStatuses[idx],
//                 status: serverUserStatus,
//                 updated_at: nowIso,
//                 staff: userStatuses[idx].staff ?? (currentStaff as any) ?? (currentUserName ? ({ staff_id: currentUserId, name: currentUserName } as any) : undefined),
//               };
//             }

//             return {
//               ...d,
//               current_status: (result.newDiaryStatus ? (result.newDiaryStatus as any) : d.current_status),
//               user_statuses: userStatuses,
//             };
//           })
//         );
//       })
//       .catch((e) => {
//         console.error(e);
//         setLocalDiaries(before);
//         alert('エラー: ステータス更新に失敗しました');
//       })
//       .finally(() => {
//         setPendingStatusByDiaryId(prev => {
//           const next = { ...prev };
//           delete next[diaryId];
//           return next;
//         });
//       });
//   };

//   const handleDiaryClick = (diary: DiaryWithRelations) => {
//     setSelectedDiary(diary);
//   };

//   const handleModalClose = () => {
//     setSelectedDiary(null);
//   };

//   const handleUpdate = () => {
//     router.refresh();
//   };

//   return (
//     <>
//       <DiaryList
//         diaries={localDiaries}
//         currentUserId={currentUserId}
//         currentUserName={currentUserName}
//         isAdmin={isAdmin}
//         allStaff={staffList}
//         jobTypes={jobTypes}
//         onStatusChange={handleStatusChange}
//         onDiaryClick={handleDiaryClick}
//         onUpdate={handleUpdate}
//         pendingStatusByDiaryId={pendingStatusByDiaryId}
//       />

//       {selectedDiary && (
//         <DiaryDetailModal
//           diary={selectedDiary}
//           currentUserId={currentUserId}
//           isAdmin={isAdmin}
//           categories={categories}
//           staffList={staffList}
//           jobTypes={jobTypes}
//           onClose={handleModalClose}
//           onUpdate={handleUpdate}
//         />
//       )}
//     </>
//   );
// }


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

// 旧: 即時にUI反映していたが、反応が早すぎるとの指摘により微小ディレイを追加
// const STATUS_UI_DELAY_MS = 0;
const STATUS_UI_DELAY_MS = 180; // ms 単位の遅延

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
  const [isPending, startTransition] = useTransition();

  // 選択中の日報は ID 管理
  const [selectedDiaryId, setSelectedDiaryId] = useState<number | null>(null);
  const [localDiaries, setLocalDiaries] = useState<DiaryWithRelations[]>(diaries);
  const [pendingStatusByDiaryId, setPendingStatusByDiaryId] = useState<Record<number, boolean>>({});

  const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  // staff / jobTypes を並列取得
  useEffect(() => {
    Promise.all([getActiveStaff(), getJobTypes()])
      .then(([staff, jobs]) => {
        setStaffList(staff);
        setJobTypes(jobs);
      })
      .catch(console.error);
  }, []);

  // サーバーから渡された日報一覧をローカル状態に同期
  useEffect(() => {
    setLocalDiaries(diaries);
  }, [diaries]);

  // 選択中の日報を導出
  // const selectedDiary = useMemo(() => {
  //   if (selectedDiaryId == null) return null;
  //   return diaries.find(d => d.diary_id === selectedDiaryId) ?? null;
  // }, [diaries, selectedDiaryId]);
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

      const before = localDiaries;
      const target = localDiaries.find(d => d.diary_id === diaryId);
      const prevUserStatus = target?.user_statuses?.find(us => us.staff_id === currentUserId)?.status ?? 'UNREAD';
      const isToggleOff = prevUserStatus === status;
      const optimisticUserStatus: UserStatus = (isToggleOff ? 'UNREAD' : status) as UserStatus;

      const currentStaff = staffList.find(s => s.staff_id === currentUserId);

      // 楽観的UI更新
      setPendingStatusByDiaryId(prev => ({ ...prev, [diaryId]: true }));
      // 旧: 即時反映
      // setLocalDiaries(prev => {
      //   ...
      // });

      startTransition(async () => {
        // 反応が早すぎるとの指摘に合わせ、微小ディレイ後にUI反映
        if (STATUS_UI_DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, STATUS_UI_DELAY_MS));
        }

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
              } as any;
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

            // DIARY側のcurrent_statusはON時のみ追従（SOLVEDは常にSOLVED）
            let nextDiaryStatus = d.current_status as any;
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

        try {
          const result = await updateUserDiaryStatus(diaryId, currentUserId, status);
          if (!result?.success) {
            setLocalDiaries(before);
            alert(`エラー: ${result?.error || 'ステータス更新に失敗しました'}`);
            return;
          }

          // サーバー結果で確定（SOLVED解除時など）
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
            const next = { ...prev } as Record<number, boolean>;
            delete next[diaryId];
            return next;
          });
        }
      });
    },
    [currentUserId, currentUserName, staffList, localDiaries]
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
      {/* <div className={isPending ? 'opacity-50 pointer-events-none' : ''}> */}
      <div className="">
        <DiaryList
          // diaries={diaries}
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
      </div>

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
