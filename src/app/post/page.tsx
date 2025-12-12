'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { createDiary, getCategories, getCurrentStaff, getJobTypes } from '@/app/actions/diary';
import { getActiveStaff } from '@/app/actions/staff';
import { MentionInput, type MentionInputHandle } from '@/components/diary/MentionInput';
import { MentionButton } from '@/components/diary/MentionButton';
import { toISODateString, getToday } from '@/lib/utils';
import type { Category, StaffBasicInfo, CurrentStaffInfo, JobType } from '@/types/database.types';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
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

export default function PostPage() {
  const router = useRouter();
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
      } catch (e) {
        console.error('Error loading data:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* カテゴリ選択 */}
              <div className="space-y-2">
                <label htmlFor="category_id" className="text-sm font-medium text-slate-700">
                  カテゴリ <span className="text-red-500">*</span>
                </label>
                <Select id="category_id" name="category_id" required>
                  <option value="">選択してください</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 日付 */}
              <div className="space-y-2">
                <label htmlFor="target_date" className="text-sm font-medium text-slate-700">
                  日付 <span className="text-red-500">*</span>
                </label>
                <Input
                  id="target_date"
                  name="target_date"
                  type="date"
                  defaultValue={toISODateString(getToday())}
                  required
                />
              </div>

              {/* 期限 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  期限
                </label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="has-deadline"
                    checked={hasDeadline}
                    onChange={(e) => setHasDeadline(e.target.checked)}
                  />
                  <label htmlFor="has-deadline" className="text-sm text-slate-600">
                    {hasDeadline ? '期限あり' : '期限なし'}
                  </label>
                </div>
                {hasDeadline && (
                  <Input
                    id="deadline"
                    name="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={toISODateString(getToday())}
                  />
                )}
              </div>

              {/* タイトル */}
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-slate-700">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="日報のタイトルを入力"
                  required
                  maxLength={100}
                />
              </div>

              {/* 内容 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="content" className="text-sm font-medium text-slate-700">
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
                  className="min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent resize-none"
                />
                <input type="hidden" name="content" value={content} required />
              </div>

              {/* 至急フラグ */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">至急</p>
                    <p className="text-xs text-slate-500">
                      緊急の対応が必要な場合はONにしてください
                    </p>
                  </div>
                </div>
                <Switch id="is_urgent" name="is_urgent" />
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-3">
              <SubmitButton />
              <Link href="/" className="w-full">
                <Button type="button" variant="ghost" className="w-full">
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

