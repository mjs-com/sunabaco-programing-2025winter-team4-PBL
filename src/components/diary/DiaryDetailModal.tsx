'use client';

import { useState, useTransition, useEffect } from 'react';
import { X, Edit2, Trash2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { CategoryBadge } from './CategoryBadge';
import { UserInitial } from './UserInitial';
import { cn, formatTime, formatDate } from '@/lib/utils';
import type { DiaryWithRelations } from '@/types/database.types';
import { updateDiary, deleteDiary, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import { MentionInput } from './MentionInput';
import type { Category, StaffBasicInfo, JobType } from '@/types/database.types';

interface DiaryDetailModalProps {
  diary: DiaryWithRelations;
  currentUserId?: number;
  isAdmin?: boolean;
  categories: Category[];
  staffList?: StaffBasicInfo[];
  jobTypes?: JobType[];
  onClose: () => void;
  onUpdate?: () => void;
}

export function DiaryDetailModal({
  diary,
  currentUserId,
  isAdmin = false,
  categories,
  staffList = [],
  jobTypes = [],
  onClose,
  onUpdate,
}: DiaryDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loadedStaffList, setLoadedStaffList] = useState<StaffBasicInfo[]>(staffList);
  const [loadedJobTypes, setLoadedJobTypes] = useState<JobType[]>(jobTypes);

  const isOwner = diary.staff_id === currentUserId;
  // diary_type カラムが存在しない場合は undefined になるため安全にチェック
  const isCleaningDuty = (diary as any).diary_type === 'CLEANING_DUTY';
  const canEdit = (isOwner || isAdmin) && !isCleaningDuty;

  // スタッフ一覧と職種一覧をロード（まだロードされていない場合）
  useEffect(() => {
    if (loadedStaffList.length === 0) {
      getActiveStaff().then(setLoadedStaffList).catch(console.error);
    }
    if (loadedJobTypes.length === 0) {
      getJobTypes().then(setLoadedJobTypes).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 編集済みかどうか
  const isEdited = diary.updated_at && diary.updated_at !== diary.created_at;

  const [editForm, setEditForm] = useState({
    title: diary.title,
    content: diary.content,
    category_id: diary.category_id,
    is_urgent: diary.is_urgent,
  });

  const handleUpdate = async (formData: FormData) => {
    if (!currentUserId) {
      setError('ログインが必要です');
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await updateDiary(diary.diary_id, {
        title: editForm.title,
        content: editForm.content,
        category_id: editForm.category_id,
        is_urgent: editForm.is_urgent,
        staff_id: currentUserId,
      });

      if (result.success) {
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } else {
        setError(result.error || '更新に失敗しました');
      }
    });
  };

  const handleDelete = () => {
    if (!currentUserId) {
      setError('ログインが必要です');
      return;
    }

    if (!confirm('本当にこの日報を削除しますか？この操作は取り消せません。')) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    startTransition(async () => {
      const result = await deleteDiary(diary.diary_id, currentUserId);

      if (result.success) {
        onClose();
        if (onUpdate) onUpdate();
      } else {
        setError(result.error || '削除に失敗しました');
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">日報詳細</h2>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  編集
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting || isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  削除
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {isEditing ? (
            <form action={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">タイトル</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">カテゴリ</label>
                <Select
                  value={editForm.category_id}
                  onChange={(e) => setEditForm({ ...editForm, category_id: parseInt(e.target.value) })}
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">内容</label>
                <MentionInput
                  value={editForm.content}
                  onChange={(value) => setEditForm({ ...editForm, content: value })}
                  staffList={loadedStaffList}
                  jobTypes={loadedJobTypes}
                  placeholder="日報の内容を入力（@でメンション）"
                  rows={8}
                  className="flex min-h-[200px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">至急</p>
                    <p className="text-xs text-slate-500">緊急の対応が必要な場合はONにしてください</p>
                  </div>
                </div>
                <Switch
                  id="edit-urgent"
                  checked={editForm.is_urgent}
                  onChange={(e) => setEditForm({ ...editForm, is_urgent: e.target.checked })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      title: diary.title,
                      content: diary.content,
                      category_id: diary.category_id,
                      is_urgent: diary.is_urgent,
                    });
                    setError(null);
                  }}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? '更新中...' : '更新する'}
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* タイトル */}
              <div className="flex items-start gap-2">
                {diary.is_urgent && (
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <h3 className="text-xl font-semibold text-slate-800 flex-1">{diary.title}</h3>
              </div>

              {/* メタ情報 */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <CategoryBadge categoryName={diary.category?.category_name || ''} />
                <span className="text-slate-500">
                  {diary.staff?.name || '不明'}
                </span>
                <span className="text-slate-400">
                  {formatDate(diary.target_date)} {formatTime(diary.created_at)}
                </span>
                {isEdited && (
                  <button
                    onClick={() => {
                      const editorName = diary.updated_by_staff?.name || diary.staff?.name || '不明';
                      const editTime = formatDate(diary.updated_at) + ' ' + formatTime(diary.updated_at);
                      alert(`編集者: ${editorName}\n編集日時: ${editTime}`);
                    }}
                    className="text-xs text-slate-400 italic hover:text-slate-600 underline"
                    title="編集履歴を表示"
                  >
                    編集済み
                  </button>
                )}
              </div>

              {/* 内容 */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {diary.content}
                </p>
              </div>

              {/* 返信一覧 */}
              {diary.replies && diary.replies.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">返信 ({diary.replies.length})</h4>
                  <div className="space-y-3">
                    {diary.replies.map((reply) => (
                      <div key={reply.diary_id} className="bg-slate-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <UserInitial
                            name={reply.staff?.name || '?'}
                            status={reply.current_status}
                            className="h-6 w-6 text-[10px]"
                          />
                          <span className="font-medium text-slate-700">{reply.staff?.name}</span>
                          <span className="text-xs text-slate-400">{formatTime(reply.created_at)}</span>
                        </div>
                        <p className="text-slate-600 whitespace-pre-wrap pl-8">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

