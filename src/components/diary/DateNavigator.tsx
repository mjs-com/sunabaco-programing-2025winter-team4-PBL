'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate, toISODateString, addDays, getToday } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

interface DateNavigatorProps {
  currentDate: Date;
}

// 指定された年月の最終日を取得
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 有効な日付に調整（例: 2月31日 → 2月28日）
function adjustToValidDate(year: number, month: number, day: number): Date {
  const lastDay = getLastDayOfMonth(year, month);
  const validDay = Math.min(day, lastDay);
  return new Date(year, month - 1, validDay);
}

export function DateNavigator({ currentDate }: DateNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = getToday();
  const isToday = toISODateString(currentDate) === toISODateString(today);
  
  // 日付選択ポップアップの表示状態
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  
  // 検索パネルの表示状態
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  
  // 検索条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateFromEnabled, setDateFromEnabled] = useState(false);
  const [dateToEnabled, setDateToEnabled] = useState(true);
  
  // 検索期間（開始日）
  const [fromYear, setFromYear] = useState(currentDate.getFullYear());
  const [fromMonth, setFromMonth] = useState(1);
  const [fromDay, setFromDay] = useState(1);
  
  // 検索期間（終了日）- デフォルトは本日
  const [toYear, setToYear] = useState(today.getFullYear());
  const [toMonth, setToMonth] = useState(today.getMonth() + 1);
  const [toDay, setToDay] = useState(today.getDate());
  
  // 検索モードかどうか（URLパラメータから判定）
  const isSearchMode = !!searchParams.get('search');
  
  // 選択中の年月日
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(currentDate.getDate());
  
  // 年の選択肢（現在年から前後20年）
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 41 }, (_, i) => currentYear - 20 + i);
  
  // 月の選択肢（1〜12）
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // 日の選択肢（1〜31）
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // ポップアップが開いたときに現在の日付を反映
  useEffect(() => {
    if (isPickerOpen) {
      setSelectedYear(currentDate.getFullYear());
      setSelectedMonth(currentDate.getMonth() + 1);
      setSelectedDay(currentDate.getDate());
    }
  }, [isPickerOpen, currentDate]);

  // ポップアップ外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
      if (searchPanelRef.current && !searchPanelRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isPickerOpen || isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen, isSearchOpen]);

  const navigateToDate = (date: Date) => {
    const dateString = toISODateString(date);
    router.push(`/?date=${dateString}`);
  };

  const goToPreviousDay = () => {
    navigateToDate(addDays(currentDate, -1));
  };

  const goToNextDay = () => {
    navigateToDate(addDays(currentDate, 1));
  };

  const goToToday = () => {
    navigateToDate(today);
  };

  const handleDateSubmit = () => {
    const validDate = adjustToValidDate(selectedYear, selectedMonth, selectedDay);
    navigateToDate(validDate);
    setIsPickerOpen(false);
  };

  // 検索を実行
  const handleSearch = () => {
    if (!searchKeyword.trim()) {
      return;
    }
    
    const params = new URLSearchParams();
    params.set('search', searchKeyword.trim());
    
    if (dateFromEnabled) {
      const fromDate = adjustToValidDate(fromYear, fromMonth, fromDay);
      params.set('from', toISODateString(fromDate));
    }
    
    if (dateToEnabled) {
      const toDate = adjustToValidDate(toYear, toMonth, toDay);
      params.set('to', toISODateString(toDate));
    }
    
    router.push(`/?${params.toString()}`);
    setIsSearchOpen(false);
  };

  // 検索モードを解除して通常表示に戻る
  const handleClearSearch = () => {
    setSearchKeyword('');
    setDateFromEnabled(false);
    setDateToEnabled(true);
    // 本日の日付で終了日をリセット
    setToYear(today.getFullYear());
    setToMonth(today.getMonth() + 1);
    setToDay(today.getDate());
    router.push('/');
  };

  return (
    <div className="sticky top-14 z-40 bg-slate-50 border-b border-slate-200">
      <div className="container mx-auto px-4 py-3">
        {/* 検索モードの場合は検索結果ヘッダーを表示 */}
        {isSearchMode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary-500" />
              <span className="font-semibold text-lg text-slate-800">
                「{searchParams.get('search')}」の検索結果
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
              className="text-xs"
            >
              ✕ 検索を解除
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {/* 前日ボタン */}
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousDay}
              className="text-slate-600"
              aria-label="前日"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            {/* 日付表示 */}
            <div className="relative flex items-center">
              {/* クリック可能な日付表示エリア */}
              <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                title="日付を選択"
              >
                <Calendar className="h-5 w-5 text-primary-500" />
                <span className="font-semibold text-lg text-slate-800">
                  {formatDate(currentDate)}
                </span>
              </button>
              
              {/* 日付選択ポップアップ */}
              {isPickerOpen && (
                <div
                  ref={pickerRef}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50 min-w-[280px]"
                >
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-700">日付を選択</span>
                    <button
                      onClick={() => setIsPickerOpen(false)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  
                  {/* ドロップダウン */}
                  <div className="flex items-center gap-2 mb-4">
                    {/* 年 */}
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="flex-1 px-2 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}年
                        </option>
                      ))}
                    </select>
                    
                    {/* 月 */}
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {months.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                    
                    {/* 日 */}
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(Number(e.target.value))}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {days.map((day) => (
                        <option key={day} value={day}>
                          {day}日
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* ボタン */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const t = getToday();
                        setSelectedYear(t.getFullYear());
                        setSelectedMonth(t.getMonth() + 1);
                        setSelectedDay(t.getDate());
                      }}
                      className="flex-1"
                    >
                      今日
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDateSubmit}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white"
                    >
                      移動
                    </Button>
                  </div>
                </div>
              )}
              
              {!isToday && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="ml-2 text-xs"
                >
                  今日
                </Button>
              )}
              
              {/* 検索ボタン */}
              <div className="relative ml-2">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-primary-100 hover:bg-primary-200 text-primary-700 transition-colors text-sm"
                  title="記事を検索"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">検索</span>
                </button>
                
                {/* 検索パネル */}
                {isSearchOpen && (
                  <div
                    ref={searchPanelRef}
                    className="fixed top-[120px] left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50 w-[320px] sm:w-[360px]"
                  >
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-slate-700">🔍 記事を検索</span>
                      <button
                        onClick={() => setIsSearchOpen(false)}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <X className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                    
                    {/* キーワード入力 */}
                    <div className="mb-4">
                      <label className="block text-sm text-slate-600 mb-1">キーワード</label>
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearch();
                          }
                        }}
                        placeholder="例: インフル"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                      />
                    </div>
                    
                    {/* 期間設定 */}
                    <div className="mb-4 space-y-3">
                      <span className="block text-sm text-slate-600">期間</span>
                      
                      {/* 開始日 */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="dateFromEnabled"
                          checked={dateFromEnabled}
                          onChange={(e) => setDateFromEnabled(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                        />
                        <label htmlFor="dateFromEnabled" className="text-sm text-slate-600 w-8">
                          開始
                        </label>
                        {dateFromEnabled ? (
                          <div className="flex items-center gap-1 flex-1">
                            <select
                              value={fromYear}
                              onChange={(e) => setFromYear(Number(e.target.value))}
                              className="flex-1 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {years.map((year) => (
                                <option key={year} value={year}>{year}年</option>
                              ))}
                            </select>
                            <select
                              value={fromMonth}
                              onChange={(e) => setFromMonth(Number(e.target.value))}
                              className="w-16 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {months.map((month) => (
                                <option key={month} value={month}>{month}月</option>
                              ))}
                            </select>
                            <select
                              value={fromDay}
                              onChange={(e) => setFromDay(Number(e.target.value))}
                              className="w-16 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {days.map((day) => (
                                <option key={day} value={day}>{day}日</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">期限なし</span>
                        )}
                      </div>
                      
                      <div className="text-center text-slate-400 text-sm">〜</div>
                      
                      {/* 終了日 */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="dateToEnabled"
                          checked={dateToEnabled}
                          onChange={(e) => setDateToEnabled(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                        />
                        <label htmlFor="dateToEnabled" className="text-sm text-slate-600 w-8">
                          終了
                        </label>
                        {dateToEnabled ? (
                          <div className="flex items-center gap-1 flex-1">
                            <select
                              value={toYear}
                              onChange={(e) => setToYear(Number(e.target.value))}
                              className="flex-1 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {years.map((year) => (
                                <option key={year} value={year}>{year}年</option>
                              ))}
                            </select>
                            <select
                              value={toMonth}
                              onChange={(e) => setToMonth(Number(e.target.value))}
                              className="w-16 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {months.map((month) => (
                                <option key={month} value={month}>{month}月</option>
                              ))}
                            </select>
                            <select
                              value={toDay}
                              onChange={(e) => setToDay(Number(e.target.value))}
                              className="w-16 px-1 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              {days.map((day) => (
                                <option key={day} value={day}>{day}日</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">期限なし</span>
                        )}
                      </div>
                    </div>
                    
                    {/* 検索ボタン */}
                    <Button
                      onClick={handleSearch}
                      disabled={!searchKeyword.trim()}
                      className="w-full bg-primary-500 hover:bg-primary-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      🔍 検索
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 翌日ボタン */}
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
              className="text-slate-600"
              aria-label="翌日"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

