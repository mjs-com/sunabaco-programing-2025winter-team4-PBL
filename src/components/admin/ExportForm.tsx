'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getDiariesForExport } from '@/app/actions/export';
import { convertToCSV } from '@/lib/export-utils';

export function ExportForm() {
  // 今月の初日と最終日をデフォルト値として設定
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const defaultStartDate = firstDayOfMonth.toISOString().split('T')[0];
  const defaultEndDate = lastDayOfMonth.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number | null>(null);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('開始日と終了日を入力してください');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('開始日は終了日より前である必要があります');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecordCount(null);

    try {
      const data = await getDiariesForExport(startDate, endDate);
      setRecordCount(data.length);

      if (data.length === 0) {
        setError('指定期間にデータがありません');
        setIsLoading(false);
        return;
      }

      // CSVに変換
      const csv = convertToCSV(data);

      // ファイル名を生成（YYYY年MM月_日報エクスポート.csv）
      const start = new Date(startDate);
      const end = new Date(endDate);
      const fileName = `${start.getFullYear()}年${String(start.getMonth() + 1).padStart(2, '0')}月_${end.getFullYear()}年${String(end.getMonth() + 1).padStart(2, '0')}月_日報エクスポート.csv`;

      // Blobを作成してダウンロード
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'エクスポートに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 先月の期間を設定
  const setLastMonth = () => {
    const today = new Date();
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    setStartDate(firstDayOfLastMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfLastMonth.toISOString().split('T')[0]);
  };

  // 今月の期間を設定
  const setThisMonth = () => {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">月次レポート出力</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Supabaseに蓄積された日報データをCSV形式でエクスポートします
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 期間選択 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              期間選択
            </label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                onClick={setLastMonth}
                variant="outline"
                size="sm"
              >
                先月
              </Button>
              <Button
                type="button"
                onClick={setThisMonth}
                variant="outline"
                size="sm"
              >
                今月
              </Button>
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">
                  開始日
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <span className="text-slate-400 mt-6">〜</span>
              <div className="flex-1">
                <label className="block text-xs text-slate-600 mb-1">
                  終了日
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* 成功メッセージ */}
        {recordCount !== null && !error && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {recordCount}件のデータをエクスポートしました
          </div>
        )}

        {/* エクスポートボタン */}
        <div className="flex justify-end">
          <Button
            onClick={handleExport}
            disabled={isLoading || !startDate || !endDate}
            className="min-w-[200px]"
          >
            {isLoading ? 'エクスポート中...' : 'CSVをダウンロード'}
          </Button>
        </div>

        {/* 使い方 */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            使い方
          </h3>
          <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
            <li>出力したい期間を選択してください（開始日と終了日）</li>
            <li>「CSVをダウンロード」ボタンをクリックします</li>
            <li>ダウンロードしたCSVファイルをGoogle スプレッドシートにインポートしてください</li>
            <li>スプレッドシート上でピボットテーブルやグラフを作成して分析を行います</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
