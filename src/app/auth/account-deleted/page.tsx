import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlertCircle, LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-red-100 p-3 rounded-full">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            アカウント削除済み
          </h1>
          <p className="text-gray-600">
            このアカウントは削除されています。
          </p>
        </div>

        <div className="bg-red-50 p-4 rounded-lg text-left text-sm text-red-800 space-y-2">
          <p>
            管理者の操作により、このアカウントは無効化されました。
            ご不明な点がある場合は、管理者にお問い合わせください。
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
