'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Edit, Trash2, Copy, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  getMyRecurringSettings,
  updateRecurringSetting,
  deleteRecurringSetting
} from '@/app/actions/recurrence';
import { getCurrentStaff } from '@/app/actions/diary';
import type { RecurringSettingWithRelations } from '@/types/database.types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function RecurrenceSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<RecurringSettingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<number | null>(null);

  // 編集用状態
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editRecurrenceType, setEditRecurrenceType] = useState<string>('daily');
  const [editWeekDays, setEditWeekDays] = useState<number[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const staff = await getCurrentStaff();
      if (!staff) {
        setError('ログインが必要です');
        return;
      }
      setCurrentStaffId(staff.staff_id);

      const data = await getMyRecurringSettings(staff.staff_id);
      setSettings(data);
    } catch (e) {
      console.error('Error loading settings:', e);
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const handleEditStart = (setting: RecurringSettingWithRelations) => {
    setEditingId(setting.id);
    setEditEndDate(setting.end_date);
    
    // recurrence_typeを正規化（custom系はdailyにマッピング）
    let normalizedType = setting.recurrence_type;
    if (normalizedType === 'custom' || normalizedType === 'custom_date' || normalizedType === 'custom_weekday') {
      normalizedType = 'daily'; // 編集画面ではdailyにマッピング
    }
    setEditRecurrenceType(normalizedType);
    
    const config = setting.recurrence_config || {};
    setEditWeekDays(config.weekDays || []);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditEndDate('');
    setEditRecurrenceType('daily');
    setEditWeekDays([]);
  };

  const handleWeekDayToggle = (day: number) => {
    setEditWeekDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleEditSave = async (settingId: number) => {
    if (!currentStaffId) return;
    setUpdating(true);
    try {
      const recurrenceConfig: any = {
        type: editRecurrenceType,
        endDate: editEndDate,
      };

      if (editRecurrenceType === 'weekly') {
        if (editWeekDays.length === 0) {
          alert('曜日を選択してください');
          setUpdating(false);
          return;
        }
        recurrenceConfig.weekDays = editWeekDays;
      }

      const result = await updateRecurringSetting(settingId, currentStaffId, {
        end_date: editEndDate,
        recurrence_type: editRecurrenceType,
        recurrence_config: recurrenceConfig
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      await loadData();
      setEditingId(null);
    } catch (e: any) {
      alert(`更新に失敗しました: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDuplicate = (setting: RecurringSettingWithRelations) => {
    // クエリパラメータとして設定情報を渡す
    const params = new URLSearchParams({
      duplicate: 'true',
      title: setting.title,
      content: setting.content || '',
      category_id: setting.category_id?.toString() || '',
      is_urgent: setting.is_urgent ? 'true' : 'false',
      recurrence_type: setting.recurrence_type,
      recurrence_config: JSON.stringify(setting.recurrence_config || {}),
    });
    router.push(`/post?${params.toString()}`);
  };

  const handleDelete = async (settingId: number) => {
    if (!currentStaffId) return;
    if (!confirm('この設定を削除しますか？\n※未来の未実施の投稿も削除されます。過去の投稿は残ります。')) {
      return;
    }

    setUpdating(true);
    try {
      const result = await deleteRecurringSetting(settingId, currentStaffId);

      if (!result.success) {
        throw new Error(result.error);
      }

      await loadData();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const getRecurrenceText = (setting: RecurringSettingWithRelations) => {
    const { recurrence_type, recurrence_config } = setting;
    
    switch (recurrence_type) {
      case 'daily': return '毎日';
      case 'weekly': {
        const days = recurrence_config?.weekDays || [];
        return `毎週 (${days.map((d: number) => WEEKDAYS[d]).join('・')})`;
      }
      case 'monthly': return '毎月';
      case 'yearly': return '毎年';
      case 'custom': return 'カスタム';
      default: return recurrence_type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/" className="flex items-center text-slate-600 hover:text-slate-800 -ml-2 p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="ml-2 font-semibold text-lg text-slate-800 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary-500" />
            繰り返し投稿の管理
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : settings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <RefreshCw className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">繰り返し設定はありません</h3>
            <p className="text-slate-500 mb-6">
              日報投稿画面で「繰り返し」を有効にすると、<br/>
              ここに設定が表示されます。
            </p>
            <Link href="/post">
              <Button>日報を書く</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {settings.map((setting) => (
              <Card key={setting.id} className={`p-4 ${!setting.is_active ? 'opacity-60 bg-slate-50' : ''}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!setting.is_active && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded">停止中</span>
                        )}
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                          {setting.category?.category_name || 'カテゴリ未設定'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {getRecurrenceText(setting)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800 truncate">
                        {setting.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">開始:</span>
                      <span>{setting.start_date}</span>
                    </div>
                    
                    {editingId === setting.id ? (
                      <div className="space-y-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 font-medium text-xs whitespace-nowrap">頻度:</span>
                          <Select
                            value={editRecurrenceType || 'daily'}
                            onChange={(e) => setEditRecurrenceType(e.target.value)}
                            className="h-9 text-sm min-w-[160px] py-1"
                          >
                            <option value="daily">毎日</option>
                            <option value="weekly">毎週（曜日指定）</option>
                            <option value="monthly">毎月</option>
                            <option value="yearly">毎年</option>
                          </Select>
                        </div>
                        {editRecurrenceType === 'weekly' && (
                          <div className="space-y-1">
                            <span className="text-slate-700 font-medium text-xs">曜日:</span>
                            <div className="flex flex-wrap gap-1">
                              {WEEKDAYS.map((day, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleWeekDayToggle(idx)}
                                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                    editWeekDays.includes(idx)
                                      ? 'bg-primary-500 text-white border-primary-500'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 font-medium text-xs whitespace-nowrap">終了:</span>
                          <Input 
                            type="date" 
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="h-9 w-36 text-sm py-1"
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleEditSave(setting.id)}
                            disabled={updating}
                            className="h-9 px-3"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={handleEditCancel}
                            disabled={updating}
                            className="h-9 px-3"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-slate-800" 
                          onClick={() => handleEditStart(setting)}
                        >
                          <span className="text-slate-400">終了:</span>
                          <span className={new Date(setting.end_date) < new Date() ? 'text-red-500' : ''}>
                            {setting.end_date}
                          </span>
                          <Edit className="h-3 w-3 text-slate-400" />
                        </div>
                      </>
                    )}
                  </div>

                  {editingId !== setting.id && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditStart(setting)}
                        className="text-slate-600"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        編集
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(setting)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        複製
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(setting.id)}
                        className="text-red-500 border-red-200 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        削除
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
