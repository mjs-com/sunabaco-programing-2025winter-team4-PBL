import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { CheckCircle, LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            登録手続き完了
          </h1>
          <p className="text-gray-600">
            メールアドレスの確認が完了しました。
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-left text-sm text-blue-800 space-y-2">
          <p className="font-semibold">アカウント承認待ちです</p>
          <p>
            セキュリティのため、管理者がアカウントを承認するまでログインすることはできません。
            承認完了まで今しばらくお待ちください。
          </p>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <form action={logout}>
            <Button variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              トップページに戻る（ログアウト）
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
