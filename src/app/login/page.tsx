'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ClipboardList, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { login, registerStaff } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ログイン中...
        </>
      ) : (
        'ログイン'
      )}
    </Button>
  );
}

function RegisterSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          登録中...
        </>
      ) : (
        '登録申請を送信'
      )}
    </Button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleLogin(formData: FormData) {
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleRegister(formData: FormData) {
    setError(null);
    const result = await registerStaff(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
      setTimeout(() => {
        setMode('login');
        setSuccess(false);
      }, 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src="/images/app_logo.png"
            alt="タスクボード ロゴ"
            className="w-3/4 mx-auto"
          />
          <p className="text-sm text-slate-500 mt-1">
            業務引き継ぎ・日報共有アプリ
          </p>

          {/* タブ切り替え */}
          <div className="mt-4 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(false);
              }}
              className={cn(
                'flex-1 pb-2 text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccess(false);
              }}
              className={cn(
                'flex-1 pb-2 text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              新規登録
            </button>
          </div>
        </CardHeader>

        {mode === 'login' ? (
          <form action={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="example@clinic.com"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                  パスワード
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-4">
              <LoginSubmitButton />
              <p className="text-xs text-center text-slate-500">
                ログイン情報がわからない場合は管理者にお問い合わせください
              </p>
            </CardFooter>
          </form>
        ) : (
          <form action={handleRegister}>
            <CardContent className="space-y-4">
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600">
                  登録申請を受け付けました。管理者の承認をお待ちください。
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="register-name" className="text-sm font-medium text-slate-700">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-name"
                    name="name"
                    type="text"
                    placeholder="山田 太郎"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-email" className="text-sm font-medium text-slate-700">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    placeholder="example@clinic.com"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-password" className="text-sm font-medium text-slate-700">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-slate-500">6文字以上で入力してください</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-job-type" className="text-sm font-medium text-slate-700">
                  職種 <span className="text-red-500">*</span>
                </label>
                <Select id="register-job-type" name="job_type_id" required>
                  <option value="">選択してください</option>
                  <option value="1">医師</option>
                  <option value="2">看護師</option>
                  <option value="3">医療事務</option>
                </Select>
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-4">
              <RegisterSubmitButton />
              <p className="text-xs text-center text-slate-500">
                登録後、管理者の承認が必要です。承認までお待ちください。
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
