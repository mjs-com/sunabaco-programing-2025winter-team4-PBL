// src/components/LogoutButton.tsx
'use client';

import { LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

export function LogoutButton() {
  return (
    <form action={logout} className="w-full">
      <button
        type="submit"
        className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 transition-colors mb-4"
      >
        <LogOut className="h-4 w-4" />
        <span>ログアウト</span>
      </button>
    </form>
  );
}