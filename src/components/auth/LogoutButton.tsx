'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    await logout();
    router.push('/login');
  };

  return (
    <button 
      onClick={handleLogout}
      className="text-xs text-red-600 hover:underline leading-none"
    >
      ログアウト
    </button>
  );
}
