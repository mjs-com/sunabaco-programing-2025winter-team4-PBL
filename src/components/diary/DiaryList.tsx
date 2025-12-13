// 'use client';

// import React from 'react';
// import { DiaryCard } from './DiaryCard';
// import { FileText, CheckCheck } from 'lucide-react';
// import type {
//   DiaryWithRelations,
//   UserStatus,
//   StaffBasicInfo,
//   JobType,
// } from '@/types/database.types';

// interface DiaryListProps {
//   diaries: DiaryWithRelations[];
//   currentUserId?: number;
//   currentUserName?: string;
//   isAdmin?: boolean;
//   allStaff?: StaffBasicInfo[];
//   jobTypes?: JobType[];
//   onStatusChange?: (diaryId: number, status: UserStatus) => void;
//   onDiaryClick?: (diaryId: number) => void;
//   onUpdate?: () => void;
//   pendingStatusByDiaryId?: Record<number, boolean>;
// }

// export const DiaryList = React.memo(function DiaryList({
//   diaries,
//   currentUserId,
//   currentUserName,
//   isAdmin,
//   allStaff,
//   jobTypes,
//   onStatusChange,
//   onDiaryClick,
//   onUpdate,
//   pendingStatusByDiaryId,
// }: DiaryListProps) {
//   if (diaries.length === 0) {
//     return (
//       <div className="flex flex-col items-center justify-center py-16 text-slate-400">
//         <FileText className="h-16 w-16 mb-4" />
//         <p className="text-lg font-medium">この日の日報はありません</p>
//         <p className="text-sm mt-1">右下の＋ボタンから新規投稿できます</p>
//       </div>
//     );
//   }

//   const unsolvedDiaries = diaries.filter(d => d.current_status !== 'SOLVED');
//   const solvedDiaries = diaries.filter(d => d.current_status === 'SOLVED');

//   const renderDiaryCard = (diary: DiaryWithRelations) => (
//     <DiaryCard
//       key={diary.diary_id}
//       diary={diary}
//       currentUserId={currentUserId}
//       currentUserName={currentUserName}
//       isAdmin={isAdmin}
//       allStaff={allStaff}
//       jobTypes={jobTypes}
//       onStatusChange={onStatusChange}
//       onClick={onDiaryClick ? () => onDiaryClick(diary.diary_id) : undefined}
//       onUpdate={onUpdate}
//       isStatusUpdating={!!pendingStatusByDiaryId?.[diary.diary_id]}
//     />
//   );

//   return (
//     <div className="space-y-6">
//       {unsolvedDiaries.length > 0 && (
//         <div className="space-y-4">
//           {unsolvedDiaries.map(renderDiaryCard)}
//         </div>
//       )}

//       {solvedDiaries.length > 0 && (
//         <div className="space-y-4">
//           <div className="flex items-center gap-2 py-2 border-b border-slate-200">
//             <CheckCheck className="h-5 w-5 text-purple-500" />
//             <h2 className="text-lg font-semibold text-purple-700">
//               解決済み
//             </h2>
//             <span className="text-sm text-slate-400">
//               ({solvedDiaries.length}件)
//             </span>
//           </div>
//           {solvedDiaries.map(renderDiaryCard)}
//         </div>
//       )}
//     </div>
//   );
// });

'use client';

import React from 'react';
import { DiaryCard } from './DiaryCard';
import { FileText, CheckCheck } from 'lucide-react';
import type {
  DiaryWithRelations,
  UserStatus,
  StaffBasicInfo,
  JobType,
} from '@/types/database.types';

interface DiaryListProps {
  diaries: DiaryWithRelations[];
  currentUserId?: number;
  currentUserName?: string;
  isAdmin?: boolean;
  allStaff?: StaffBasicInfo[];
  jobTypes?: JobType[];
  onStatusChange?: (diaryId: number, status: UserStatus) => void;
  onDiaryClick?: (diaryId: number) => void;
  onUpdate?: () => void;
  pendingStatusByDiaryId?: Record<number, boolean>;
}

export const DiaryList = React.memo(function DiaryList({
  diaries,
  currentUserId,
  currentUserName,
  isAdmin,
  allStaff,
  jobTypes,
  onStatusChange,
  onDiaryClick,
  onUpdate,
  pendingStatusByDiaryId,
}: DiaryListProps) {
  if (diaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FileText className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium">この日の日報はありません</p>
        <p className="text-sm mt-1">右下の＋ボタンから新規投稿できます</p>
      </div>
    );
  }

  const unsolvedDiaries = diaries.filter(d => d.current_status !== 'SOLVED');
  const solvedDiaries = diaries.filter(d => d.current_status === 'SOLVED');

  const renderDiaryCard = (diary: DiaryWithRelations) => (
    <DiaryCard
      key={diary.diary_id}
      diary={diary}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      isAdmin={isAdmin}
      allStaff={allStaff}
      jobTypes={jobTypes}
      onStatusChange={onStatusChange}
      onClick={onDiaryClick ? () => onDiaryClick(diary.diary_id) : undefined}
      onUpdate={onUpdate}
      isStatusUpdating={!!pendingStatusByDiaryId?.[diary.diary_id]}
    />
  );

  return (
    <div className="space-y-6">
      {unsolvedDiaries.length > 0 && (
        <div className="space-y-4">
          {unsolvedDiaries.map(renderDiaryCard)}
        </div>
      )}

      {solvedDiaries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 py-2 border-b border-slate-200">
            <CheckCheck className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-purple-700">
              解決済み
            </h2>
            <span className="text-sm text-slate-400">
              ({solvedDiaries.length}件)
            </span>
          </div>
          {solvedDiaries.map(renderDiaryCard)}
        </div>
      )}
    </div>
  );
});
