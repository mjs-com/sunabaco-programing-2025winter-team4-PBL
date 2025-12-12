'use client';

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { AtSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { StaffBasicInfo, JobType } from '@/types/database.types';

export interface MentionInputHandle {
  insertAt: (position?: number) => void;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  staffList: StaffBasicInfo[];
  jobTypes: JobType[];
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
  showAtButton?: boolean; // @ボタンを表示するかどうか
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(({
  value,
  onChange,
  staffList,
  jobTypes,
  placeholder = '内容を入力...',
  rows = 6,
  className,
  id,
  showAtButton = true, // デフォルトは表示
}, ref) => {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // メンション候補を生成
  const getMentionSuggestions = (query: string) => {
    const lowerQuery = query.toLowerCase();
    const suggestions: Array<{ type: 'all' | 'job' | 'person'; label: string; value: string; jobName?: string }> = [];

    // @All
    if ('all'.includes(lowerQuery)) {
      suggestions.push({ type: 'all', label: '@All (全員)', value: '@All' });
    }

    // 職種
    jobTypes.forEach((job) => {
      if (job.job_name.toLowerCase().includes(lowerQuery)) {
        suggestions.push({
          type: 'job',
          label: `@${job.job_name}`,
          value: `@${job.job_name}`,
          jobName: job.job_name,
        });
      }
    });

    // 個人名
    staffList.forEach((staff) => {
      if (staff.name.toLowerCase().includes(lowerQuery)) {
        suggestions.push({
          type: 'person',
          label: `@${staff.name}`,
          value: `@${staff.name}`,
        });
      }
    });

    return suggestions.slice(0, 10); // 最大10件
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // @の後にスペースや改行がない場合
      if (!textAfterAt.match(/[\s\n]/)) {
        setMentionQuery(textAfterAt);
        setMentionPosition(lastAtIndex);
        setShowMentionMenu(true);
        return;
      }
    }

    setShowMentionMenu(false);
  };

  const handleMentionSelect = (mentionValue: string) => {
    const textBefore = value.substring(0, mentionPosition);
    const textAfter = value.substring(textareaRef.current?.selectionStart || value.length);
    const newValue = textBefore + mentionValue + ' ' + textAfter;
    onChange(newValue);
    setShowMentionMenu(false);
    setMentionQuery('');

    // テキストエリアにフォーカスを戻す
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = mentionPosition + mentionValue.length + 1;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertAtSymbol = (position?: number) => {
    const cursorPos = position ?? textareaRef.current?.selectionStart ?? value.length;
    const newValue = value.substring(0, cursorPos) + '@' + value.substring(cursorPos);
    onChange(newValue);
    
    // 候補を表示するための状態更新
    setMentionQuery('');
    setMentionPosition(cursorPos);
    setShowMentionMenu(true);

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }, 0);
  };

  const handleAtButtonClick = () => {
    insertAtSymbol();
  };

  // 外部から呼び出せるようにrefを公開
  useImperativeHandle(ref, () => ({
    insertAt: insertAtSymbol,
  }));

  const suggestions = showMentionMenu ? getMentionSuggestions(mentionQuery) : [];

  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowMentionMenu(false);
      }
    };

    if (showMentionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentionMenu]);

  return (
    <div className="relative">
      <div className={showAtButton ? "flex gap-2" : ""}>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (showMentionMenu && suggestions.length > 0) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                e.preventDefault();
                // TODO: キーボードナビゲーション実装
              }
            }
          }}
          placeholder={placeholder}
          rows={rows}
          className={className}
        />
        {showAtButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAtButtonClick}
            className="flex-shrink-0"
            title="@メンション"
          >
            <AtSign className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* メンション候補メニュー */}
      {showMentionMenu && suggestions.length > 0 && (
        <div
          ref={menuRef}
          className="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          style={{
            top: textareaRef.current
              ? textareaRef.current.offsetHeight + 4
              : 0,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleMentionSelect(suggestion.value)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="font-medium text-slate-800">{suggestion.label}</div>
              {suggestion.type === 'job' && (
                <div className="text-xs text-slate-500">職種でメンション</div>
              )}
              {suggestion.type === 'person' && (
                <div className="text-xs text-slate-500">個人でメンション</div>
              )}
              {suggestion.type === 'all' && (
                <div className="text-xs text-slate-500">全員にメンション</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

MentionInput.displayName = 'MentionInput';

