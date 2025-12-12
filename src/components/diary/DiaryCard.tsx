'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle, Clock, MessageSquare, CheckCheck, Send, X, Edit2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { CategoryBadge } from './CategoryBadge';
import { cn, formatTime, formatDate } from '@/lib/utils';
import type { DiaryWithRelations, UserStatus, StaffWithRelations, JobType } from '@/types/database.types';
import { createDiary, updateDiary, deleteDiary } from '@/app/actions/diary';

interface DiaryCardProps {
  diary: DiaryWithRelations;
  currentUserId?: number;
  currentUserName?: string;
  isAdmin?: boolean;
  allStaff?: StaffWithRelations[];
  jobTypes?: JobType[];
  onStatusChange?: (diaryId: number, status: UserStatus) => void;
  onClick?: () => void;
  onUpdate?: () => void;
}

// 職種に応じたアイコンの背景色を取得
export function getJobTypeColor(jobName?: string): string {
  switch (jobName) {
    case '医師':
      return 'bg-blue-500';
    case '看護師':
      return 'bg-pink-500';
    case '医療事務':
    case '事務':
      return 'bg-yellow-500';
    default:
      return 'bg-slate-500';
  }
}

// メンションされているスタッフIDを取得
function getMentionedStaffIds(
  content: string,
  allStaff: StaffWithRelations[],
  jobTypes: JobType[]
): number[] {
  const mentionedIds: Set<number> = new Set();
  
  // @All の場合は全員
  if (content.includes('@All')) {
    allStaff.forEach(staff => mentionedIds.add(staff.staff_id));
    return Array.from(mentionedIds);
  }
  
  // @職種名 の場合
  jobTypes.forEach(jt => {
    if (content.includes(`@${jt.job_name}`)) {
      allStaff
        .filter(staff => staff.job_type_id === jt.job_type_id)
        .forEach(staff => mentionedIds.add(staff.staff_id));
    }
  });
  
  // @個人名 の場合
  allStaff.forEach(staff => {
    if (content.includes(`@${staff.name}`)) {
      mentionedIds.add(staff.staff_id);
    }
  });
  
  return Array.from(mentionedIds);
}

export function DiaryCard({ 
  diary, 
  currentUserId, 
  currentUserName, 
  isAdmin, 
  allStaff = [], 
  jobTypes = [],
  onStatusChange, 
  onClick, 
  onUpdate 
}: DiaryCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isUrgentReply, setIsUrgentReply] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // リプライ編集状態
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState('');

  // 現在のユーザーのステータスを取得
  const currentUserStatus = diary.user_statuses?.find(us => us.staff_id === currentUserId)?.status;

  const handleStatusChange = (status: UserStatus) => {
    if (onStatusChange) {
      onStatusChange(diary.diary_id, status);
    }
  };

  const handleReplySubmit = async (formData: FormData) => {
    if (!currentUserId) {
      alert('ログインが必要です');
      return;
    }

    const content = formData.get('content') as string;
    if (!content.trim()) return;

    startTransition(async () => {
      const result = await createDiary({
        category_id: diary.category_id,
        staff_id: currentUserId,
        title: `Re: ${diary.title}`,
        content: content,
        target_date: diary.target_date,
        is_urgent: isUrgentReply,
        parent_id: diary.diary_id,
      });

      if (result.success) {
        setShowReplyForm(false);
        setIsUrgentReply(false);
        onUpdate?.();
      } else {
        alert('返信の投稿に失敗しました');
      }
    });
  };

  // リプライの編集を開始
  const handleStartEditReply = (reply: DiaryWithRelations) => {
    setEditingReplyId(reply.diary_id);
    setEditingReplyContent(reply.content);
  };

  // リプライの編集を保存
  const handleSaveEditReply = async (replyId: number) => {
    if (!currentUserId || !editingReplyContent.trim()) return;

    startTransition(async () => {
      const result = await updateDiary(
        replyId,
        {
          content: editingReplyContent,
          staff_id: currentUserId,
        }
      );

      if (result.success) {
        setEditingReplyId(null);
        setEditingReplyContent('');
        onUpdate?.();
      } else {
        alert('編集に失敗しました');
      }
    });
  };

  // リプライの削除
  const handleDeleteReply = async (replyId: number) => {
    if (!currentUserId) return;
    if (!confirm('この返信を削除しますか？')) return;

    startTransition(async () => {
      const result = await deleteDiary(replyId, currentUserId);
      if (result.success) {
        onUpdate?.();
      } else {
        alert('削除に失敗しました');
      }
    });
  };

  // カテゴリに応じたヘッダー色
  const getCategoryHeaderColor = (categoryName?: string) => {
    switch (categoryName) {
      case '診察':
        return 'bg-cyan-50 border-cyan-200';
      case '看護':
        return 'bg-pink-50 border-pink-200';
      case '事務':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  // 枠線の色を決定（期限・至急・解決済み）
  const getBorderStyle = () => {
    // 解決済みの場合は枠線なし
    if (diary.current_status === 'SOLVED') {
      return '';
    }

    // 至急の場合は赤枠
    if (diary.is_urgent) {
      return 'border-4 border-red-500';
    }

    // 期限がある場合
    if (diary.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(diary.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // 期限当日以降は赤枠
      if (daysUntilDeadline <= 0) {
        return 'border-4 border-red-500';
      }
      // 期限3日前から前日までは黄色枠
      if (daysUntilDeadline <= 3) {
        return 'border-4 border-yellow-500';
      }
    }

    return '';
  };

  // 編集済みかどうか
  const isEdited = diary.updated_at && diary.updated_at !== diary.created_at;

  // ステータスごとにユーザーをグループ化
  const workingUsers = diary.user_statuses?.filter(us => us.status === 'WORKING') || [];
  const confirmedUsers = diary.user_statuses?.filter(us => us.status === 'CONFIRMED') || [];
  const solvedUsers = diary.user_statuses?.filter(us => us.status === 'SOLVED') || [];
  
  // 確認済み・作業中・解決済みのスタッフID
  const actionedStaffIds = new Set([
    ...workingUsers.map(us => us.staff_id),
    ...confirmedUsers.map(us => us.staff_id),
    ...solvedUsers.map(us => us.staff_id),
  ]);
  
  // メンションされているスタッフID
  const mentionedStaffIds = getMentionedStaffIds(diary.content || '', allStaff, jobTypes);
  
  // 未確認ユーザー（メンションされているがまだアクションを起こしていない人）
  const unconfirmedStaff = allStaff.filter(
    staff => mentionedStaffIds.includes(staff.staff_id) && !actionedStaffIds.has(staff.staff_id)
  );

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      getBorderStyle()
    )}>
      <CardHeader 
        className={cn(
          "pb-2 border-b-2 rounded-t-lg",
          getCategoryHeaderColor(diary.category?.category_name),
          onClick && "cursor-pointer hover:opacity-90 transition-all"
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* タイトル行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {diary.is_urgent && diary.current_status !== 'SOLVED' && (
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-slate-800 truncate">
                {diary.title}
              </h3>
              {diary.deadline && diary.current_status !== 'SOLVED' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  期限: {formatDate(diary.deadline)}
                </span>
              )}
            </div>

            {/* メタ情報 */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <CategoryBadge categoryName={diary.category?.category_name || ''} />
              <span className="text-xs text-slate-500">
                {diary.staff?.name || '不明'}
              </span>
              <span className="text-xs text-slate-400">
                {formatTime(diary.created_at)}
              </span>
              {isEdited && (
                <span className="text-xs text-slate-400 italic">
                  編集済み
                </span>
              )}
            </div>

            {/* 解決者表示 */}
            {diary.current_status === 'SOLVED' && diary.solved_by_staff && (
              <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded inline-block">
                解決者: {diary.solved_by_staff.name}
                {diary.solved_at && ` (${formatDate(diary.solved_at)} ${formatTime(diary.solved_at)})`}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-3 space-y-4">
        <p className="text-sm text-slate-600 whitespace-pre-wrap">
          {diary.content}
        </p>

        {/* 返信一覧 */}
        {diary.replies && diary.replies.length > 0 && (
          <div className="mt-4 space-y-2 pl-4 border-l-2 border-slate-100">
            {diary.replies.map((reply) => {
              const replyJobName = (reply.staff as any)?.job_type?.job_name;
              const isReplyUrgent = reply.is_urgent && diary.current_status !== 'SOLVED';
              const canEditReply = currentUserId === reply.staff_id || isAdmin;
              const isEditing = editingReplyId === reply.diary_id;
              
              return (
                <div 
                  key={reply.diary_id} 
                  className={cn(
                    "bg-slate-50 p-3 rounded-lg text-sm",
                    isReplyUrgent && "border-2 border-red-500"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                        getJobTypeColor(replyJobName)
                      )}>
                        {reply.staff?.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-slate-700">{reply.staff?.name}</span>
                      <span className="text-xs text-slate-400">{formatTime(reply.created_at)}</span>
                      {isReplyUrgent && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      {reply.updated_at && reply.updated_at !== reply.created_at && (
                        <span className="text-xs text-slate-400 italic">編集済み</span>
                      )}
                    </div>
                    
                    {/* 編集・削除ボタン */}
                    {canEditReply && !isEditing && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleStartEditReply(reply)}
                          className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                          title="編集"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteReply(reply.diary_id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="削除"
                          disabled={isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="pl-8 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={editingReplyContent}
                        onChange={(e) => setEditingReplyContent(e.target.value)}
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingReplyId(null);
                            setEditingReplyContent('');
                          }}
                          disabled={isPending}
                        >
                          キャンセル
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEditReply(reply.diary_id)}
                          disabled={isPending}
                          className="bg-primary-500 hover:bg-primary-600"
                        >
                          {isPending ? '保存中...' : '保存'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-600 whitespace-pre-wrap pl-8">{reply.content}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 返信フォーム */}
        {showReplyForm && (
          <form 
            action={handleReplySubmit} 
            className="mt-4 pl-4 border-l-2 border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <Textarea
                name="content"
                placeholder="返信内容を入力..."
                className="min-h-[80px] text-sm"
                autoFocus
                required
              />
              
              {/* 至急フラグ */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={isUrgentReply}
                  onCheckedChange={setIsUrgentReply}
                  id="urgent-reply"
                />
                <label htmlFor="urgent-reply" className="text-sm text-slate-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  至急
                </label>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReplyForm(false);
                    setIsUrgentReply(false);
                  }}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-primary-500 hover:bg-primary-600"
                >
                  {isPending ? '送信中...' : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      送信
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>

      {/* アクションボタン */}
      <CardFooter className="flex-col items-stretch gap-3">
        {/* 1行目: 確認した、作業中、解決済み */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex-1 min-w-[70px] text-green-600 border-green-200",
              currentUserStatus === 'CONFIRMED' 
                ? "bg-green-100 hover:bg-green-200" 
                : "hover:bg-green-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange('CONFIRMED' as UserStatus);
            }}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            確認した
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex-1 min-w-[70px] text-blue-600 border-blue-200",
              currentUserStatus === 'WORKING' 
                ? "bg-blue-100 hover:bg-blue-200" 
                : "hover:bg-blue-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange('WORKING' as UserStatus);
            }}
          >
            <Clock className="h-4 w-4 mr-1" />
            作業中
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex-1 min-w-[70px] text-purple-600 border-purple-200",
              (currentUserStatus === 'SOLVED' || diary.current_status === 'SOLVED')
                ? "bg-purple-100 hover:bg-purple-200" 
                : "hover:bg-purple-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange('SOLVED' as UserStatus);
            }}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            解決済み
          </Button>
        </div>
        
        {/* 2行目: 返信するボタン（モバイルで大きく表示） */}
        <Button
          variant={showReplyForm ? "secondary" : "outline"}
          size="sm"
          className="w-full py-3 text-slate-600 border-slate-200 hover:bg-slate-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowReplyForm(!showReplyForm);
          }}
        >
          {showReplyForm ? <X className="h-4 w-4 mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
          {showReplyForm ? '閉じる' : '返信する'}
        </Button>

        {/* ステータス表示（セクション分け） */}
        {(workingUsers.length > 0 || unconfirmedStaff.length > 0 || confirmedUsers.length > 0) && (
          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
            {/* 担当（作業中） */}
            {workingUsers.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-medium min-w-[70px]">担当:</span>
                <div className="flex items-center gap-1 flex-wrap flex-1">
                  {workingUsers.map((us) => {
                    const jobName = (us.staff as any)?.job_type?.job_name;
                    return (
                      <div 
                        key={us.id}
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                          getJobTypeColor(jobName)
                        )}
                        title={us.staff?.name}
                      >
                        {us.staff?.name?.charAt(0) || '?'}
                      </div>
                    );
                  })}
                  <span className="text-slate-600 ml-1">
                    {workingUsers.map(us => us.staff?.name?.split(' ')[0] || us.staff?.name?.charAt(0)).join('、')}
                  </span>
                </div>
              </div>
            )}

            {/* 未確認（メンションされているが未アクション） */}
            {unconfirmedStaff.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-orange-600 font-medium min-w-[70px]">未確認:</span>
                <div className="flex items-center gap-1 flex-wrap flex-1">
                  {unconfirmedStaff.map((staff) => {
                    const jobName = (staff as any)?.job_type?.job_name;
                    return (
                      <div 
                        key={staff.staff_id}
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold opacity-60",
                          getJobTypeColor(jobName)
                        )}
                        title={staff.name}
                      >
                        {staff.name?.charAt(0) || '?'}
                      </div>
                    );
                  })}
                  <span className="text-slate-600 ml-1">
                    {unconfirmedStaff.map(s => s.name?.split(' ')[0] || s.name?.charAt(0)).join('、')}
                  </span>
                </div>
              </div>
            )}

            {/* 確認済 */}
            {confirmedUsers.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-medium min-w-[70px]">確認済:</span>
                <div className="flex items-center gap-1 flex-wrap flex-1">
                  {confirmedUsers.map((us) => {
                    const jobName = (us.staff as any)?.job_type?.job_name;
                    return (
                      <div 
                        key={us.id}
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                          getJobTypeColor(jobName)
                        )}
                        title={us.staff?.name}
                      >
                        {us.staff?.name?.charAt(0) || '?'}
                      </div>
                    );
                  })}
                  <span className="text-slate-600 ml-1">
                    {confirmedUsers.map(us => us.staff?.name?.split(' ')[0] || us.staff?.name?.charAt(0)).join('、')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
