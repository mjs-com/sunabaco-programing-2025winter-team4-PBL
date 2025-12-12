'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Repeat, X, Save, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { cn, getToday, toISODateString, formatDate, getStaffColorById } from '@/lib/utils';
import { getCurrentStaff } from '@/app/actions/diary';
import { getMonthlyPoints } from '@/app/actions/points';
import { getActiveStaff } from '@/app/actions/staff';
import {
  deleteCleaningDutyAssignmentForDate,
  getCleaningDutyAssignmentsByRange,
  setCleaningDutyAssignmentForDate,
  upsertCleaningDutyAssignments,
  type CleaningDutyAssignment,
} from '@/app/actions/cleaningDuty';
import type { CurrentStaffInfo, StaffBasicInfo } from '@/types/database.types';

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
] as const;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getYearEnd(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function getFiscalYearEnd(date: Date): Date {
  // 年度末=3/31。4月以降なら翌年3/31、1〜3月なら当年3/31
  const year = date.getMonth() >= 3 ? date.getFullYear() + 1 : date.getFullYear();
  return new Date(year, 2, 31);
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export default function CleaningDutyCalendarPage() {
  const [isPending, startTransition] = useTransition();

  const [isLoading, setIsLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<CurrentStaffInfo | null>(null);
  const [monthlyPoints, setMonthlyPoints] = useState(0);
  const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);

  const [monthCursor, setMonthCursor] = useState<Date>(getMonthStart(getToday()));
  const [assignments, setAssignments] = useState<CleaningDutyAssignment[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 編集権限（ログイン中のユーザーは全員編集可能）
  const canEdit = !!currentStaff;

  // 繰り返し登録モーダル
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recStaffId, setRecStaffId] = useState<number>(0);
  const [recStartDate, setRecStartDate] = useState<string>(toISODateString(getToday()));
  const [recEndDate, setRecEndDate] = useState<string>(toISODateString(addMonths(getToday(), 1)));
  const [recWeekDays, setRecWeekDays] = useState<number[]>([1]);

  // 単日編集モーダル
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayDate, setDayDate] = useState<string>('');
  const [dayStaffId, setDayStaffId] = useState<number>(0);
  const [dayRepeatEnabled, setDayRepeatEnabled] = useState(false);
  const [dayRepeatEndDate, setDayRepeatEndDate] = useState<string>(toISODateString(addMonths(getToday(), 1)));
  const [dayRepeatWeekDays, setDayRepeatWeekDays] = useState<number[]>([]);

  const monthRange = useMemo(() => {
    const start = getMonthStart(monthCursor);
    const end = getMonthEnd(monthCursor);
    return {
      start,
      end,
      startISO: toISODateString(start),
      endISO: toISODateString(end),
    };
  }, [monthCursor]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((a) => map.set(a.duty_date, a.staff_id));
    return map;
  }, [assignments]);

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>();
    staffList.forEach((s) => map.set(s.staff_id, s.name));
    return map;
  }, [staffList]);

  // スタッフごとのパーソナルカラー（未設定はスタッフIDから自動生成）
  const staffColorMap = useMemo(() => {
    const map = new Map<number, string>();
    staffList.forEach((s) => {
      // DBに保存された色があればそれを使用、なければIDから自動生成
      const color = s.personal_color || getStaffColorById(s.staff_id);
      map.set(s.staff_id, color);
    });
    return map;
  }, [staffList]);

  const calendarCells = useMemo(() => {
    const start = monthRange.start;
    const firstDow = start.getDay();
    const daysInMonth = monthRange.end.getDate();

    const cells: Array<{ date: Date; iso: string } | null> = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - firstDow + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(null);
        continue;
      }
      const d = new Date(start.getFullYear(), start.getMonth(), dayNum);
      cells.push({ date: d, iso: toISODateString(d) });
    }
    return cells;
  }, [monthRange]);

  async function loadBase() {
    try {
      const staff = await getCurrentStaff();
      if (!staff) {
        setCurrentStaff(null);
        setIsLoading(false);
        return;
      }
      setCurrentStaff(staff as unknown as CurrentStaffInfo);

      const [points, staffs] = await Promise.all([
        getMonthlyPoints(staff.staff_id),
        getActiveStaff(),
      ]);
      setMonthlyPoints(points);
      setStaffList(staffs);

      // 初期値（繰り返し登録の担当者）
      setRecStaffId(staffs[0]?.staff_id ?? 0);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssignments() {
    const data = await getCleaningDutyAssignmentsByRange(monthRange.startISO, monthRange.endISO);
    setAssignments(data);
  }

  useEffect(() => {
    loadBase().catch((e) => {
      console.error(e);
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAssignments().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRange.startISO, monthRange.endISO]);

  const openDayModal = (iso: string) => {
    if (!canEdit) return;
    setError(null);
    setSuccess(null);
    setDayDate(iso);
    setDayStaffId(assignmentMap.get(iso) ?? 0);
    setDayRepeatEnabled(false);
    setDayRepeatEndDate(toISODateString(addMonths(parseISODate(iso), 1)));
    // 曜日は選択された日の曜日をデフォルトに
    setDayRepeatWeekDays([parseISODate(iso).getDay()]);
    setShowDayModal(true);
  };

  const toggleWeekDay = (d: number) => {
    setRecWeekDays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d].sort((a, b) => a - b);
    });
  };

  const toggleDayRepeatWeekDay = (d: number) => {
    setDayRepeatWeekDays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d].sort((a, b) => a - b);
    });
  };

  const setPresetEnd = (preset: '1m' | '6m' | '1y' | 'year_end' | 'fiscal_end') => {
    const base = parseISODate(recStartDate);
    let end: Date;
    switch (preset) {
      case '1m':
        end = addMonths(base, 1);
        break;
      case '6m':
        end = addMonths(base, 6);
        break;
      case '1y':
        end = addMonths(base, 12);
        break;
      case 'year_end':
        end = getYearEnd(base);
        break;
      case 'fiscal_end':
        end = getFiscalYearEnd(base);
        break;
    }
    setRecEndDate(toISODateString(end));
  };

  const setDayPresetEnd = (preset: '1m' | '6m' | '1y' | 'year_end' | 'fiscal_end') => {
    if (!dayDate) return;
    const base = parseISODate(dayDate);
    let end: Date;
    switch (preset) {
      case '1m':
        end = addMonths(base, 1);
        break;
      case '6m':
        end = addMonths(base, 6);
        break;
      case '1y':
        end = addMonths(base, 12);
        break;
      case 'year_end':
        end = getYearEnd(base);
        break;
      case 'fiscal_end':
        end = getFiscalYearEnd(base);
        break;
    }
    setDayRepeatEndDate(toISODateString(end));
  };

  const handleSaveRecurring = () => {
    if (!canEdit) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await upsertCleaningDutyAssignments({
        staffId: recStaffId,
        startDate: recStartDate,
        endDate: recEndDate,
        weekDays: recWeekDays,
      });

      if (!res.success) {
        setError(res.error || '登録に失敗しました');
        return;
      }

      setSuccess('繰り返し登録しました');
      setShowRecurringModal(false);
      // 登録後は曜日選択をリセット（次回登録時に誤って上書きしないように）
      setRecWeekDays([]);
      await loadAssignments();
    });
  };

  const handleSaveDay = () => {
    if (!canEdit) return;
    if (!dayDate) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      if (!dayStaffId) {
        const res = await deleteCleaningDutyAssignmentForDate(dayDate);
        if (!res.success) {
          setError(res.error || '解除に失敗しました');
          return;
        }
        setSuccess('解除しました');
        setShowDayModal(false);
        await loadAssignments();
        return;
      }

      // 「この日から繰り返し」ONの場合は、登録画面と同等の一括上書き
      if (dayRepeatEnabled) {
        const res = await upsertCleaningDutyAssignments({
          staffId: dayStaffId,
          startDate: dayDate,
          endDate: dayRepeatEndDate,
          weekDays: dayRepeatWeekDays.length > 0 ? dayRepeatWeekDays : [parseISODate(dayDate).getDay()],
        });
        if (!res.success) {
          setError(res.error || '繰り返し保存に失敗しました');
          return;
        }
        setSuccess('繰り返しで保存しました');
      } else {
        const res = await setCleaningDutyAssignmentForDate(dayDate, dayStaffId);
        if (!res.success) {
          setError(res.error || '保存に失敗しました');
          return;
        }
        setSuccess('保存しました');
      }

      setShowDayModal(false);
      await loadAssignments();
    });
  };

  const handleDeleteDay = () => {
    if (!canEdit) return;
    if (!dayDate) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await deleteCleaningDutyAssignmentForDate(dayDate);
      if (!res.success) {
        setError(res.error || '解除に失敗しました');
        return;
      }

      setSuccess('解除しました');
      setShowDayModal(false);
      await loadAssignments();
    });
  };

  // スケルトンUI（ローディング中に表示）
  const CalendarSkeleton = () => (
    <div className="animate-pulse">
      {/* 曜日ヘッダ */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-600 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w.value} className={cn(w.value === 0 ? 'text-red-600' : w.value === 6 ? 'text-blue-600' : '')}>
            {w.label}
          </div>
        ))}
      </div>
      {/* スケルトンセル */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, idx) => (
          <div key={idx} className="h-20 rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header currentPoints={monthlyPoints} systemRoleId={currentStaff?.system_role_id} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-primary-500" />
            掃除当番カレンダー
          </h1>

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecurringModal(true)}
              disabled={isPending || isLoading}
              className="self-end sm:self-auto"
            >
              <Repeat className="h-4 w-4 mr-1" />
              繰り返し登録
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <Card>
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{formatYearMonth(monthCursor)}</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {canEdit
                    ? '日付をクリックするとその日の当番を変更できます'
                    : '当番者には当日、トップページに「本日の掃除当番」日報が表示されます'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonthCursor(getMonthStart(addMonths(monthCursor, -1)))}
                  disabled={isPending}
                  title="前の月"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonthCursor(getMonthStart(addMonths(monthCursor, 1)))}
                  disabled={isPending}
                  title="次の月"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="py-4">
            {isLoading ? (
              <CalendarSkeleton />
            ) : (
              <>
                {/* 曜日ヘッダ */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-600 mb-2">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w.value}
                      className={cn(w.value === 0 ? 'text-red-600' : w.value === 6 ? 'text-blue-600' : '')}
                    >
                      {w.label}
                    </div>
                  ))}
                </div>

                {/* カレンダー本体 */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={idx} className="h-20 rounded-lg bg-transparent" />;
                    }

                    const staffId = assignmentMap.get(cell.iso);
                    const staffName = staffId ? staffNameMap.get(staffId) : undefined;
                    const staffColor = staffId ? staffColorMap.get(staffId) : undefined;
                    const isSunday = cell.date.getDay() === 0;
                    const isSaturday = cell.date.getDay() === 6;
                    const isToday = cell.iso === toISODateString(getToday());

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => {
                          if (canEdit) openDayModal(cell.iso);
                        }}
                        className={cn(
                          'h-20 rounded-lg border text-left p-2 transition-all',
                          canEdit && 'cursor-pointer hover:opacity-80 hover:shadow-md',
                          !canEdit && 'cursor-default',
                          isToday && 'border-primary-500 ring-2 ring-primary-100',
                          !staffId && isSunday && 'border-red-100',
                          !staffId && isSaturday && 'border-blue-100'
                        )}
                        style={{
                          backgroundColor: staffColor || (staffId ? '#e2e8f0' : '#ffffff'),
                        }}
                        disabled={!canEdit || isPending}
                        title={canEdit ? 'クリックして当番を変更' : undefined}
                      >
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            staffColor ? 'text-slate-800' : (isSunday ? 'text-red-600' : isSaturday ? 'text-blue-600' : 'text-slate-800')
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        <div className="mt-2 text-xs text-slate-700 line-clamp-2 font-medium">
                          {staffName || ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 繰り返し登録モーダル */}
        {showRecurringModal && canEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRecurringModal(false)}>
            <div
              className="w-full max-w-lg rounded-lg bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  繰り返し登録
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowRecurringModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">担当者</label>
                  <Select value={recStaffId} onChange={(e) => setRecStaffId(Number(e.target.value))}>
                    <option value={0}>担当者なし（解除）</option>
                    {staffList.map((s) => (
                      <option key={s.staff_id} value={s.staff_id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">開始日</label>
                    <Input type="date" value={recStartDate} onChange={(e) => setRecStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">終了日</label>
                    <Input type="date" value={recEndDate} onChange={(e) => setRecEndDate(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setPresetEnd('1m')}>
                        1ヶ月後
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPresetEnd('6m')}>
                        半年後
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPresetEnd('1y')}>
                        1年後
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPresetEnd('year_end')}>
                        年末まで
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPresetEnd('fiscal_end')}>
                        年度末まで
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">繰り返し（曜日）</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((w) => {
                      const active = recWeekDays.includes(w.value);
                      return (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekDay(w.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-sm transition-colors',
                            active
                              ? 'bg-primary-500 text-white border-primary-500'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          )}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowRecurringModal(false)} disabled={isPending}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSaveRecurring} disabled={isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    {isPending ? '登録中...' : '登録'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 単日編集モーダル */}
        {showDayModal && canEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDayModal(false)}>
            <div
              className="w-full max-w-md rounded-lg bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-800">当番を変更</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowDayModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-600">{dayDate ? formatDate(dayDate) : ''}</p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">担当者</label>
                  <Select value={dayStaffId} onChange={(e) => setDayStaffId(Number(e.target.value))}>
                    <option value={0}>未設定（解除）</option>
                    {staffList.map((s) => (
                      <option key={s.staff_id} value={s.staff_id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">この日から繰り返しで設定</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ONにすると、指定期間の該当曜日がまとめて上書きされます。
                      </p>
                    </div>
                    <Switch
                      id="day-repeat"
                      checked={dayRepeatEnabled}
                      onChange={(e) => setDayRepeatEnabled(e.target.checked)}
                    />
                  </div>

                  {dayRepeatEnabled && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">終了日</label>
                        <Input
                          type="date"
                          value={dayRepeatEndDate}
                          onChange={(e) => setDayRepeatEndDate(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setDayPresetEnd('1m')}>
                            1ヶ月後
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDayPresetEnd('6m')}>
                            半年後
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDayPresetEnd('1y')}>
                            1年後
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDayPresetEnd('year_end')}>
                            年末まで
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setDayPresetEnd('fiscal_end')}>
                            年度末まで
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">曜日</label>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map((w) => {
                            const active = dayRepeatWeekDays.includes(w.value);
                            return (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() => toggleDayRepeatWeekDay(w.value)}
                                className={cn(
                                  'px-3 py-1.5 rounded-full border text-sm transition-colors',
                                  active
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                )}
                              >
                                {w.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={handleDeleteDay}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    解除
                  </Button>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowDayModal(false)} disabled={isPending}>
                      キャンセル
                    </Button>
                    <Button onClick={handleSaveDay} disabled={isPending}>
                      <Save className="h-4 w-4 mr-1" />
                      {isPending ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`);
}

