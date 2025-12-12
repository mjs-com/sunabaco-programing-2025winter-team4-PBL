'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus, Save, X, Trash2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/utils';

export interface MasterItem {
  id: number;
  name: string;
  is_active: boolean;
}

interface MasterEditListProps {
  title: string;
  description?: string;
  items: MasterItem[];
  onSave: (name: string, id?: number) => Promise<{ success?: boolean; error?: string }>;
  onToggleStatus: (id: number, isActive: boolean) => Promise<{ success?: boolean; error?: string }>;
}

export function MasterEditList({ title, description, items, onSave, onToggleStatus }: MasterEditListProps) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 編集開始
  const handleStartEdit = (item: MasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setIsAdding(false);
    setError(null);
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setError(null);
  };

  // 保存処理（編集）
  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    
    setError(null);
    startTransition(async () => {
      const result = await onSave(editName, editingId!);
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        setEditName('');
      }
    });
  };

  // 新規追加開始
  const handleStartAdd = () => {
    setIsAdding(true);
    setNewName('');
    setEditingId(null);
    setError(null);
  };

  // 新規追加キャンセル
  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewName('');
    setError(null);
  };

  // 保存処理（新規）
  const handleSaveNew = async () => {
    if (!newName.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await onSave(newName);
      if (result.error) {
        setError(result.error);
      } else {
        setIsAdding(false);
        setNewName('');
      }
    });
  };

  // ステータス切り替え
  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await onToggleStatus(id, !currentStatus);
      if (result.error) {
        setError(result.error);
        // エラー時は数秒後に消すなどの処理があると良いが、今回は簡易的に表示
        setTimeout(() => setError(null), 3000);
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        {!isAdding && (
          <Button onClick={handleStartAdd} size="sm" className="flex items-center gap-1">
            <Plus className="h-4 w-4" />
            <span>追加</span>
          </Button>
        )}
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        {/* 新規追加フォーム */}
        {isAdding && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">新規{title}名</label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${title}名を入力`}
                className="flex-1 bg-white"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
              />
              <Button onClick={handleSaveNew} disabled={isPending || !newName.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2">保存</span>
              </Button>
              <Button variant="ghost" onClick={handleCancelAdd} disabled={isPending}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* リスト */}
        <div className="space-y-2">
          {items.length === 0 && !isAdding && (
            <div className="text-center py-8 text-slate-400 text-sm">
              登録されているデータがありません
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                item.is_active ? "bg-white border-slate-100" : "bg-slate-50 border-slate-100 opacity-70"
              )}
            >
              {editingId === item.id ? (
                // 編集モード
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <Button size="sm" onClick={handleSaveEdit} disabled={isPending || !editName.trim()}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isPending}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // 表示モード
                <>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.is_active ? "bg-green-500" : "bg-slate-300"
                    )} />
                    <span className={cn(
                      "font-medium",
                      !item.is_active && "text-slate-500 line-through"
                    )}>
                      {item.name}
                    </span>
                    {!item.is_active && (
                      <span className="text-xs text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">無効</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.is_active ? '有効' : '無効'}</span>
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() => handleToggleStatus(item.id, item.is_active)}
                        disabled={isPending}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(item)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
