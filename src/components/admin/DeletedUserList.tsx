'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RotateCcw, Loader2, Trash2, ChevronDown, ChevronRight, UserX } from 'lucide-react';
import { toggleStaffDeleted, permanentlyDeleteStaff } from '@/app/actions/admin';
import { useRouter } from 'next/navigation';
import type { StaffWithRelations } from '@/types/database.types';

interface DeletedUserListProps {
  staffList: StaffWithRelations[];
}

export function DeletedUserList({ staffList }: DeletedUserListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRestore = (staffId: number) => {
    if (!confirm('このユーザーを復元しますか？再度ログインできるようになります。')) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(staffId));
    startTransition(async () => {
      const result = await toggleStaffDeleted(staffId, false);
      if (result.success) {
        router.refresh();
      } else {
        alert(`復元に失敗しました: ${result.error}`);
      }
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    });
  };

  const handlePermanentDelete = (staffId: number, staffName: string) => {
    if (!confirm(`「${staffName}」を完全削除しますか？\n\n※この操作を行うと一覧から消えます\n※データは裏で保持されます\n※画面からの復元はできなくなります`)) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(staffId));
    startTransition(async () => {
      const result = await permanentlyDeleteStaff(staffId);
      if (result.success) {
        router.refresh();
      } else {
        alert(`完全削除に失敗しました: ${result.error}`);
      }
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    });
  };

  // 削除済みユーザーがいない場合
  if (staffList.length === 0) {
    return (
      <Card className="border-slate-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
          <UserX className="h-5 w-5 text-slate-400" />
          <span className="font-medium text-slate-600">削除済みユーザー</span>
          <span className="text-sm text-slate-400">(0件)</span>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4">
            <div className="text-center py-6 text-slate-400 text-sm">
              削除済みユーザーはいません
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      {/* 折りたたみヘッダー */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-400" />
        )}
        <UserX className="h-5 w-5 text-slate-400" />
        <span className="font-medium text-slate-600">削除済みユーザー</span>
        <span className="text-sm text-slate-400">({staffList.length}件)</span>
      </button>

      {/* 展開時のコンテンツ */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            削除されたユーザーを復元できます（復職時など）
          </p>
          
          {staffList.map((staff) => {
            const isUpdating = updatingIds.has(staff.staff_id);

            return (
              <Card
                key={staff.staff_id}
                className="p-3 bg-slate-50 border-slate-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-600 truncate">{staff.name}</h3>
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {staff.email} / {staff.job_type?.job_name || '不明'}
                    </div>
                    <div className="text-xs text-slate-400">
                      削除日: {staff.updated_at ? new Date(staff.updated_at).toLocaleDateString('ja-JP') : '不明'}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(staff.staff_id)}
                      disabled={isUpdating}
                      className="whitespace-nowrap bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="mr-1 h-3 w-3" />
                          復元
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePermanentDelete(staff.staff_id, staff.name)}
                      disabled={isUpdating}
                      className="whitespace-nowrap bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-slate-500"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="mr-1 h-3 w-3" />
                          完全削除
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          
          <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-200">
            ※完全削除すると一覧から消えます（データは裏で保持されます）
          </p>
        </div>
      )}
    </Card>
  );
}
