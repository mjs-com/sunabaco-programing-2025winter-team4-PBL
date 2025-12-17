'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { createDiary, createRecurringDiaries, getCategories, getCurrentStaff, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import { MentionInput, type MentionInputHandle } from '@/components/diary/MentionInput';
import { MentionButton } from '@/components/diary/MentionButton';
import { toISODateString, getToday, addDays } from '@/lib/utils';
import type { Category, StaffBasicInfo, CurrentStaffInfo, JobType } from '@/types/database.types';

// 繰り返しパターンの型
type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom_date' | 'custom_weekday';

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
] as const;

const WEEKS_OF_MONTH = [
  { value: 1, label: '第1週' },
  { value: 2, label: '第2週' },
  { value: 3, label: '第3週' },
  { value: 4, label: '第4週' },
  { value: 5, label: '第5週' },
] as const;

// 年度末の日付を取得（4月以降なら翌年3/31、1〜3月なら当年3/31）
function getFiscalYearEnd(): Date {
  const today = getToday();
  const year = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
  return new Date(year, 2, 31);
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full py-3 text-base" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          投稿中...
        </>
      ) : (
        '投稿する'
      )}
    </Button>
  );
}

function PostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [staffList, setStaffList] = useState<StaffBasicInfo[]>([]);
  const [currentStaff, setCurrentStaff] = useState<CurrentStaffInfo | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const mentionInputRef = useRef<MentionInputHandle>(null);

  // 繰り返し設定
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  // カスタム（日付）用
  const [customInterval, setCustomInterval] = useState(1);
  const [customIntervalUnit, setCustomIntervalUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');
  // カスタム（曜日）用：第何週かと曜日の両方をマルチ選択
  const [customWeeksOfMonth, setCustomWeeksOfMonth] = useState<number[]>([]);
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>([]);

  // フォームの初期値
  const [initialTitle, setInitialTitle] = useState('');
  const [initialCategoryId, setInitialCategoryId] = useState<string>('');
  const [initialIsUrgent, setInitialIsUrgent] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, jobs, staffs, staff] = await Promise.all([
          getCategories(),
          getJobTypes(),
          getActiveStaff(),
          getCurrentStaff(),
        ]);
        setCategories(cats);
        setJobTypes(jobs);
        setStaffList(staffs);
        setCurrentStaff(staff);
        // デフォルトの終了日を1ヶ月後に設定
        setRecurrenceEndDate(toISODateString(addDays(getToday(), 30)));

        // クエリパラメータから複製データを読み込む
        const duplicate = searchParams?.get('duplicate');
        if (duplicate === 'true') {
          const title = searchParams.get('title') || '';
          const contentParam = searchParams.get('content') || '';
          const categoryId = searchParams.get('category_id') || '';
          const isUrgent = searchParams.get('is_urgent') === 'true';
          const recurrenceTypeParam = searchParams.get('recurrence_type') || 'daily';
          const recurrenceConfigParam = searchParams.get('recurrence_config');

          setInitialTitle(title);
          setInitialCategoryId(categoryId);
          setInitialIsUrgent(isUrgent);
          setContent(contentParam);
          setHasRecurrence(true);
          
          // 繰り返し設定を復元
          if (recurrenceConfigParam) {
            try {
              const config = JSON.parse(recurrenceConfigParam);
              setRecurrenceType(recurrenceTypeParam as RecurrenceType);
              
              // weekly の場合は weekDays を customDaysOfWeek に変換して表示
              // （新規投稿画面ではweeklyタイプのweekDays選択UIがないため、custom_weekdayに変換）
              if (recurrenceTypeParam === 'weekly' && config.weekDays && Array.isArray(config.weekDays) && config.weekDays.length > 0) {
                // weeklyのweekDaysをcustomDaysOfWeekに変換
                setCustomDaysOfWeek(config.weekDays);
                // すべての週を選択（第1週〜第5週）
                setCustomWeeksOfMonth([1, 2, 3, 4, 5]);
                // custom_weekdayタイプに変更
                setRecurrenceType('custom_weekday');
              }
              
              // カスタム設定の復元
              if (config.customInterval) {
                setCustomInterval(config.customInterval);
              }
              if (config.customIntervalUnit) {
                setCustomIntervalUnit(config.customIntervalUnit);
              }
              if (config.customWeeksOfMonth) {
                setCustomWeeksOfMonth(config.customWeeksOfMonth);
              }
              if (config.customDaysOfWeek && recurrenceTypeParam !== 'weekly') {
                setCustomDaysOfWeek(config.customDaysOfWeek);
              }
            } catch (e) {
              console.error('Error parsing recurrence config:', e);
            }
          }
        }
      } catch (e) {
        console.error('Error loading data:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  // weeklyタイプの場合、weekDaysをcustomDaysOfWeekに変換して表示
  useEffect(() => {
    const recurrenceConfigParam = searchParams?.get('recurrence_config');
    if (recurrenceConfigParam && recurrenceType === 'weekly') {
      try {
        const config = JSON.parse(recurrenceConfigParam);
        if (config.weekDays && Array.isArray(config.weekDays) && config.weekDays.length > 0) {
          // weeklyのweekDaysをcustomDaysOfWeekに変換（新規投稿画面ではweeklyタイプのweekDays選択UIがないため）
          // ただし、新規投稿画面ではweeklyタイプのweekDays選択UIがないため、この処理は不要
          // 複製時はweeklyタイプのまま維持する
        }
      } catch (e) {
        console.error('Error parsing recurrence config:', e);
      }
    }
  }, [recurrenceType, searchParams]);

  const toggleCustomWeekOfMonth = (week: number) => {
    setCustomWeeksOfMonth((prev) => {
      if (prev.includes(week)) return prev.filter((w) => w !== week);
      return [...prev, week].sort((a, b) => a - b);
    });
  };

  const toggleCustomDayOfWeek = (day: number) => {
    setCustomDaysOfWeek((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  async function handleSubmit(formData: FormData) {
    if (!currentStaff) {
      setError('ログインが必要です');
      return;
    }

    setError(null);

    const input = {
      category_id: parseInt(formData.get('category_id') as string),
      title: formData.get('title') as string,
      content: content, // MentionInputから取得
      target_date: formData.get('target_date') as string,
      is_urgent: formData.get('is_urgent') === 'on',
      staff_id: currentStaff.staff_id,
      deadline: hasDeadline ? deadline : null,
    };

    // 繰り返し設定がある場合
    if (hasRecurrence && recurrenceEndDate) {
      // カスタム（曜日）の場合は custom タイプに変換
      const mappedType = recurrenceType === 'custom_date' || recurrenceType === 'custom_weekday' 
        ? 'custom' 
        : recurrenceType;
      
      const recurrence = {
        type: mappedType as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
        endDate: recurrenceEndDate,
        // weekly 用（新規投稿画面ではweeklyタイプのweekDays選択UIがないため、空配列を設定）
        // ただし、custom_weekdayに変換された場合はweekDaysは設定しない
        weekDays: (recurrenceType === 'weekly' && mappedType === 'weekly') ? [] : undefined,
        // カスタム（日付）用
        customInterval: recurrenceType === 'custom_date' ? customInterval : undefined,
        customIntervalUnit: recurrenceType === 'custom_date' ? customIntervalUnit : undefined,
        // カスタム（曜日）用：複数の第N週と曜日
        customWeeksOfMonth: recurrenceType === 'custom_weekday' ? customWeeksOfMonth : undefined,
        customDaysOfWeek: recurrenceType === 'custom_weekday' ? customDaysOfWeek : undefined,
      };

      const result = await createRecurringDiaries(input, recurrence);

      if (!result.success) {
        setError(result.error || '投稿に失敗しました');
        return;
      }

      router.push('/');
      return;
    }

    // 通常の単発投稿
    const result = await createDiary(input);

    if (!result.success) {
      setError(result.error || '投稿に失敗しました');
      return;
    }

    router.push('/');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link
            href="/"
            className="flex items-center text-slate-600 hover:text-slate-800 -ml-2 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="ml-2 font-semibold text-lg text-slate-800">
            新規投稿
          </h1>
        </div>
      </header>

      {/* フォーム */}
      <main className="container mx-auto px-4 py-6">
        <Card>
          <form action={handleSubmit}>
            <CardContent className="space-y-4 p-6 pt-6">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* カテゴリ選択 */}
              <div className="space-y-3 sm:space-y-2">
                <label htmlFor="category_id" className="text-base sm:text-sm font-medium text-slate-700">
                  カテゴリ <span className="text-red-500">*</span>
                </label>
                <Select id="category_id" name="category_id" required defaultValue={initialCategoryId}>
                  <option value="">選択してください</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 日付 */}
              <div className="space-y-3 sm:space-y-2 mt-4 sm:mt-0">
                <label htmlFor="target_date" className="text-base sm:text-sm font-medium text-slate-700">
                  表示する日付 <span className="text-red-500">*</span>
                </label>
                <div className="w-full overflow-hidden">
                  <Input
                    id="target_date"
                    name="target_date"
                    type="date"
                    defaultValue={toISODateString(getToday())}
                    required
                    className="w-full max-w-full box-border"
                  />
                </div>
              </div>

              {/* 期限 */}
              <div className="space-y-3 sm:space-y-2 mt-4 sm:mt-0">
                <label className="text-base sm:text-sm font-medium text-slate-700">
                  期限（この日までの投稿）
                </label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="has-deadline"
                    checked={hasDeadline}
                    onChange={(e) => setHasDeadline(e.target.checked)}
                  />
                  <label htmlFor="has-deadline" className="text-base sm:text-sm text-slate-600">
                    {hasDeadline ? '期限あり' : '期限なし'}
                  </label>
                </div>
                {hasDeadline && (
                  <div className="w-full overflow-hidden">
                    <Input
                      id="deadline"
                      name="deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      min={toISODateString(getToday())}
                      className="w-full max-w-full box-border"
                    />
                  </div>
                )}
              </div>

              {/* 繰り返し */}
              <div className="space-y-3 sm:space-y-2 mt-4 sm:mt-0">
                <label className="text-base sm:text-sm font-medium text-slate-700">
                  繰り返し（指定した間隔で表示）
                </label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="has-recurrence"
                    checked={hasRecurrence}
                    onChange={(e) => setHasRecurrence(e.target.checked)}
                  />
                  <label htmlFor="has-recurrence" className="text-base sm:text-sm text-slate-600">
                    {hasRecurrence ? '繰り返しあり' : '繰り返しなし'}
                  </label>
                </div>

                {hasRecurrence && (
                  <div className="space-y-3 mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    {/* 繰り返しパターン */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">パターン</label>
                      <Select
                        value={recurrenceType}
                        onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                      >
                        <option value="daily">毎日</option>
                        <option value="weekly">毎週（同じ曜日）</option>
                        <option value="monthly">毎月（同じ日）</option>
                        <option value="yearly">毎年（同じ月日）</option>
                        <option value="custom_date">カスタム（日付）</option>
                        <option value="custom_weekday">カスタム（曜日）</option>
                      </Select>
                    </div>

                    {/* カスタム（日付）の場合 */}
                    {recurrenceType === 'custom_date' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">間隔</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={customInterval}
                            onChange={(e) => setCustomInterval(Number(e.target.value))}
                            className="w-20"
                          />
                          <Select
                            value={customIntervalUnit}
                            onChange={(e) => setCustomIntervalUnit(e.target.value as 'days' | 'weeks' | 'months' | 'years')}
                            className="flex-1"
                          >
                            <option value="days">日ごと</option>
                            <option value="weeks">週ごと</option>
                            <option value="months">ヶ月ごと</option>
                            <option value="years">年ごと</option>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* カスタム（曜日）の場合：第N週と曜日の両方をマルチ選択 */}
                    {recurrenceType === 'custom_weekday' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">第何週（複数選択可）</label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKS_OF_MONTH.map((w) => (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() => toggleCustomWeekOfMonth(w.value)}
                                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                  customWeeksOfMonth.includes(w.value)
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">曜日（複数選択可）</label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((w) => (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() => toggleCustomDayOfWeek(w.value)}
                                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                  customDaysOfWeek.includes(w.value)
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {customWeeksOfMonth.length > 0 && customDaysOfWeek.length > 0 && (
                          <p className="text-xs text-slate-500">
                            例：{customWeeksOfMonth.map(w => `第${w}週`).join('・')}の
                            {customDaysOfWeek.map(d => WEEKDAYS.find(wd => wd.value === d)?.label + '曜日').join('・')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 終了日 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">終了日</label>
                      <div className="w-full overflow-hidden">
                        <Input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={toISODateString(getToday())}
                          className="w-full max-w-full box-border"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(toISODateString(addDays(getToday(), 30)))}
                        >
                          1ヶ月後
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(toISODateString(addDays(getToday(), 90)))}
                        >
                          3ヶ月後
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(toISODateString(addDays(getToday(), 180)))}
                        >
                          半年後
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(toISODateString(addDays(getToday(), 365)))}
                        >
                          1年後
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(toISODateString(getFiscalYearEnd()))}
                        >
                          年度末
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* タイトル */}
              <div className="space-y-3 sm:space-y-2 mt-4 sm:mt-0">
                <label htmlFor="title" className="text-base sm:text-sm font-medium text-slate-700">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="日報のタイトルを入力"
                  required
                  maxLength={100}
                  defaultValue={initialTitle}
                />
              </div>

              {/* 内容 */}
              <div className="space-y-3 sm:space-y-2 mt-4 sm:mt-0">
                <div className="flex items-center gap-2">
                  <label htmlFor="content" className="text-base sm:text-sm font-medium text-slate-700">
                    内容 <span className="text-red-500">*</span>
                  </label>
                  <MentionButton
                    onMentionClick={() => {
                      mentionInputRef.current?.insertAt();
                    }}
                  />
                </div>
                <MentionInput
                  ref={mentionInputRef}
                  id="content-textarea"
                  value={content}
                  onChange={setContent}
                  staffList={staffList}
                  jobTypes={jobTypes}
                  placeholder="日報の内容を入力"
                  rows={6}
                  showAtButton={false}
                  className="min-h-[140px] sm:min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 sm:py-2 text-base sm:text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                />
                <p className="text-sm sm:text-base text-slate-600 mt-2">
                  💡 音声入力するには、キーボードのマイクをタップ
                </p>
                <input type="hidden" name="content" value={content} required />
              </div>

              {/* 至急フラグ */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-6 w-6 sm:h-5 sm:w-5 mt-0.5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-base sm:text-sm font-medium text-slate-700">至急</p>
                    <p className="text-sm sm:text-xs text-slate-500 mt-1">
                      緊急の対応が必要な場合はONにしてください
                    </p>
                  </div>
                </div>
                <Switch id="is_urgent" name="is_urgent" defaultChecked={initialIsUrgent} />
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-3">
              <SubmitButton />
              <Link href="/" className="w-full">
                <Button type="button" variant="ghost" className="w-full py-3 text-base">
                  キャンセル
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    }>
      <PostPageContent />
    </Suspense>
  );
}

