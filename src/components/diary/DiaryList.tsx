'use client';

import { DiaryCard } from './DiaryCard';
import type { DiaryWithRelations, UserStatus, StaffWithRelations, JobType } from '@/types/database.types';
import { FileText, CheckCheck } from 'lucide-react';

interface DiaryListProps {
  diaries: DiaryWithRelations[];
  currentUserId?: number;
  currentUserName?: string;
  isAdmin?: boolean;
  allStaff?: StaffWithRelations[];
  jobTypes?: JobType[];
  onStatusChange?: (diaryId: number, status: UserStatus) => void;
  onDiaryClick?: (diary: DiaryWithRelations) => void;
  onUpdate?: () => void;
  pendingStatusByDiaryId?: Record<number, boolean>;
}

export function DiaryList({ diaries, currentUserId, currentUserName, isAdmin, allStaff, jobTypes, onStatusChange, onDiaryClick, onUpdate, pendingStatusByDiaryId }: DiaryListProps) {
  if (diaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FileText className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium">この日の日報はありません</p>
        <p className="text-sm mt-1">右下の＋ボタンから新規投稿できます</p>
      </div>
    );
  }

  // 未解決と解決済みに分離
  const unsolvedDiaries = diaries.filter(d => d.current_status !== 'SOLVED');
  const solvedDiaries = diaries.filter(d => d.current_status === 'SOLVED');

  return (
    <div className="space-y-6">
      {/* 未解決タスク */}
      {unsolvedDiaries.length > 0 && (
        <div className="space-y-4">
          {unsolvedDiaries.map((diary) => (
            <DiaryCard
              key={diary.diary_id}
              diary={diary}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              allStaff={allStaff}
              jobTypes={jobTypes}
              onStatusChange={onStatusChange}
              onClick={onDiaryClick ? () => onDiaryClick(diary) : undefined}
              onUpdate={onUpdate}
              isStatusUpdating={!!pendingStatusByDiaryId?.[diary.diary_id]}
            />
          ))}
        </div>
      )}

      {/* 解決済みタスク */}
      {solvedDiaries.length > 0 && (
        <div className="space-y-4">
          {/* 解決済み見出し */}
          <div className="flex items-center gap-2 py-2 border-b border-slate-200">
            <CheckCheck className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-purple-700">解決済み</h2>
            <span className="text-sm text-slate-400">({solvedDiaries.length}件)</span>
          </div>

          {solvedDiaries.map((diary) => (
            <DiaryCard
              key={diary.diary_id}
              diary={diary}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              allStaff={allStaff}
              jobTypes={jobTypes}
              onStatusChange={onStatusChange}
              onClick={onDiaryClick ? () => onDiaryClick(diary) : undefined}
              onUpdate={onUpdate}
              isStatusUpdating={!!pendingStatusByDiaryId?.[diary.diary_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
