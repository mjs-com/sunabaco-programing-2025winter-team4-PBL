'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff, Trash2, Loader2, AlertCircle, Shield } from 'lucide-react';
import { toggleStaffHidden, toggleStaffDeleted, toggleStaffAdminRole } from '@/app/actions/admin';
import { useRouter } from 'next/navigation';
import type { StaffWithRelations } from '@/types/database.types';

interface UserManagementListProps {
  staffList: StaffWithRelations[];
}

export function UserManagementList({ staffList }: UserManagementListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const handleToggleHidden = (staffId: number, currentValue: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(staffId));
    startTransition(async () => {
      const result = await toggleStaffHidden(staffId, !currentValue);
      if (result.success) {
        router.refresh();
      } else {
        alert(`非表示設定の変更に失敗しました: ${result.error}`);
      }
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    });
  };

  const handleToggleDeleted = (staffId: number, currentValue: boolean) => {
    if (!confirm(
      currentValue
        ? 'このユーザーを復元しますか？ユーザー管理画面に表示されるようになります。'
        : 'このユーザーを削除しますか？ユーザー管理画面から非表示になりますが、過去記事では名前が表示されます。'
    )) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(staffId));
    startTransition(async () => {
      const result = await toggleStaffDeleted(staffId, !currentValue);
      if (result.success) {
        router.refresh();
      } else {
        alert(`削除設定の変更に失敗しました: ${result.error}`);
      }
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    });
  };

  const handleToggleAdminRole = (staffId: number, currentIsAdmin: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(staffId));
    startTransition(async () => {
      const result = await toggleStaffAdminRole(staffId, !currentIsAdmin);
      if (result.success) {
        router.refresh();
      } else {
        alert(`管理者権限の変更に失敗しました: ${result.error}`);
      }
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    });
  };

  if (staffList.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>ユーザーが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staffList.map((staff) => {
        const isUpdating = updatingIds.has(staff.staff_id);
        const isHidden = staff.is_hidden ?? false;
        const isDeleted = staff.is_deleted ?? false;
        const isAdmin = staff.system_role_id === 1;

        return (
          <Card
            key={staff.staff_id}
            className={`p-4 ${
              isHidden ? 'bg-amber-50 border-amber-200' : 'bg-white'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{staff.name}</h3>
                  {isHidden && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      非表示
                    </span>
                  )}
                  {!staff.is_active && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      承認待ち
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1 text-sm text-slate-600">
                  <p>メール: {staff.email}</p>
                  <p>
                    職種: {staff.job_type?.job_name || '不明'} / 
                    管理権限: {staff.system_role_id === 1 ? '管理者' : '一般ユーザー'}
                  </p>
                  <p className="text-xs text-slate-400">
                    登録日: {new Date(staff.created_at).toLocaleDateString('ja-JP')}
                  </p>
                  {/* スマホ版：トグルボタンと削除ボタン（横並び） */}
                  <div className="flex items-center justify-evenly mt-3 md:hidden">
                    {/* 管理者権限トグル */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Shield
                          className={`h-4 w-4 ${
                            isAdmin ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-xs text-slate-600 whitespace-nowrap">
                          {isAdmin ? '管理者' : '一般'}
                        </span>
                      </div>
                      <Switch
                        checked={isAdmin}
                        onChange={() => handleToggleAdminRole(staff.staff_id, isAdmin)}
                        disabled={isUpdating || isDeleted}
                        id={`admin-${staff.staff_id}`}
                      />
                    </div>

                    {/* 非表示トグル */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        {isHidden ? (
                          <EyeOff className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-xs text-slate-600 whitespace-nowrap">
                          {isHidden ? '非表示' : '表示中'}
                        </span>
                      </div>
                      <Switch
                        checked={isHidden}
                        onChange={() => handleToggleHidden(staff.staff_id, isHidden)}
                        disabled={isUpdating || isDeleted}
                        id={`hidden-${staff.staff_id}`}
                      />
                    </div>

                    {/* 削除ボタン */}
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant={isDeleted ? 'outline' : 'destructive'}
                        size="sm"
                        onClick={() => handleToggleDeleted(staff.staff_id, isDeleted)}
                        disabled={isUpdating}
                        className="whitespace-nowrap"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {isDeleted ? '復元中...' : '削除中...'}
                          </>
                        ) : (
                          <>
                            {isDeleted ? (
                              <>
                                <AlertCircle className="mr-1 h-3 w-3" />
                                復元
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-1 h-3 w-3" />
                                削除
                              </>
                            )}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* パソコン版：トグルボタンと削除ボタン（右側に横並び、右揃え） */}
              <div className="hidden md:flex md:flex-row md:items-center md:justify-end md:gap-4 md:ml-4">
                {/* 管理者権限トグル */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Shield
                      className={`h-4 w-4 ${
                        isAdmin ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs text-slate-600 whitespace-nowrap">
                      {isAdmin ? '管理者' : '一般'}
                    </span>
                  </div>
                  <Switch
                    checked={isAdmin}
                    onChange={() => handleToggleAdminRole(staff.staff_id, isAdmin)}
                    disabled={isUpdating || isDeleted}
                    id={`admin-${staff.staff_id}`}
                  />
                </div>

                {/* 非表示トグル */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    {isHidden ? (
                      <EyeOff className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="text-xs text-slate-600 whitespace-nowrap">
                      {isHidden ? '非表示' : '表示中'}
                    </span>
                  </div>
                  <Switch
                    checked={isHidden}
                    onChange={() => handleToggleHidden(staff.staff_id, isHidden)}
                    disabled={isUpdating || isDeleted}
                    id={`hidden-${staff.staff_id}`}
                  />
                </div>

                {/* 削除ボタン */}
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant={isDeleted ? 'outline' : 'destructive'}
                    size="sm"
                    onClick={() => handleToggleDeleted(staff.staff_id, isDeleted)}
                    disabled={isUpdating}
                    className="whitespace-nowrap"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {isDeleted ? '復元中...' : '削除中...'}
                      </>
                    ) : (
                      <>
                        {isDeleted ? (
                          <>
                            <AlertCircle className="mr-1 h-3 w-3" />
                            復元
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-1 h-3 w-3" />
                            削除
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
