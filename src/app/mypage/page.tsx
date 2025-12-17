'use client';

import { useEffect, useState, useTransition, Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User, Heart, Mail, Briefcase, Shield, Calendar, ArrowUp, ArrowDown, Edit2, Save, X, Lock, Trophy, Palette, RefreshCw } from 'lucide-react';
import { getCurrentStaff } from '@/app/actions/diary';
import { getPointHistory, getMonthlyPoints } from '@/app/actions/points';
import { updateProfile, updatePassword, updatePersonalColor } from '@/app/actions/profile';
import { formatDate, formatTime, generateRandomPersonalColor, colorToHex, cn } from '@/lib/utils';
import type { PointLog } from '@/types/database.types';

interface StaffProfile {
  staff_id: number;
  name: string;
  email: string;
  current_points: number;
  system_role_id: number;
  job_type_id: number;
  personal_color?: string | null;
  job_type?: {
    job_name: string;
  };
  system_role?: {
    role_name: string;
  };
  created_at: string;
}

// ステータスタグを日本語に置き換える関数
function replaceStatusTags(text: string): string {
  return text
    .replace(/CONFIRMED/g, '🔍 確認した')
    .replace(/WORKING/g, '🛠️ 作業中')
    .replace(/SOLVED/g, '✅ 解決済み');
}

export default function MyPage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [pointHistory, setPointHistory] = useState<PointLog[]>([]);
  const [monthlyPoints, setMonthlyPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 編集モード
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingColor, setIsEditingColor] = useState(false);

  // 編集フォームの値
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editPersonalColor, setEditPersonalColor] = useState<string>('');

  // エラー・メッセージ
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = profile?.system_role_id === 1;

  useEffect(() => {
    async function loadData() {
      try {
        const staff = await getCurrentStaff();
        if (staff) {
          setProfile(staff as StaffProfile);
          setEditName(staff.name);
          setEditEmail(staff.email);
          setEditPersonalColor(staff.personal_color || '');
          
          const [history, monthly] = await Promise.all([
            getPointHistory(staff.staff_id),
            getMonthlyPoints(staff.staff_id),
          ]);
          setPointHistory(history);
          setMonthlyPoints(monthly);
        }
        
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveProfile = () => {
    if (!profile) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateProfile({
        staff_id: profile.staff_id,
        name: editName,
        email: editEmail,
      });

      if (result.success) {
        setSuccess('プロフィールを更新しました');
        setIsEditingProfile(false);
        // プロフィールを再読み込み
        const staff = await getCurrentStaff();
        if (staff) {
          setProfile(staff as StaffProfile);
        }
      } else {
        setError(result.error || '更新に失敗しました');
      }
    });
  };

  const handleSavePassword = () => {
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updatePassword({ newPassword });

      if (result.success) {
        setSuccess('パスワードを更新しました');
        setIsEditingPassword(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || '更新に失敗しました');
      }
    });
  };


  const handleSavePersonalColor = () => {
    if (!profile) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updatePersonalColor(profile.staff_id, editPersonalColor);

      if (result.success) {
        setSuccess('パーソナルカラーを更新しました');
        setIsEditingColor(false);
        // プロフィールを再読み込み
        const staff = await getCurrentStaff();
        if (staff) {
          setProfile(staff as StaffProfile);
          setEditPersonalColor(staff.personal_color || '');
        }
      } else {
        setError(result.error || '更新に失敗しました');
      }
    });
  };

  const handleGenerateRandomColor = () => {
    const newColor = generateRandomPersonalColor();
    setEditPersonalColor(newColor);
  };

  const cancelEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditEmail(profile.email);
      setEditPersonalColor(profile.personal_color || '');
    }
    setNewPassword('');
    setConfirmPassword('');
    setIsEditingProfile(false);
    setIsEditingPassword(false);
    setIsEditingColor(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header currentPoints={0} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header currentPoints={0} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16 text-slate-500">
            プロフィール情報が見つかりません
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header 
        currentPoints={monthlyPoints} 
        systemRoleId={profile.system_role_id}
      />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">マイページ</h1>

        {/* メッセージ表示 */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-600">
            {success}
          </div>
        )}

        {/* プロフィールカード */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold">
                  {profile.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{profile.name}</h2>
                  <p className="text-sm text-slate-500">{profile.job_type?.job_name || '未設定'}</p>
                </div>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  編集
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">名前</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="名前を入力"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">メールアドレス</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="メールアドレスを入力"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
                    <X className="h-4 w-4 mr-1" />
                    キャンセル
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    {isPending ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <span>{profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <span>{profile.job_type?.job_name || '未設定'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Shield className="h-5 w-5 text-slate-400" />
                  <span>{profile.system_role_id === 1 ? '管理者' : '一般ユーザー'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <span>登録日: {formatDate(profile.created_at)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* パスワード変更カード */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Lock className="h-5 w-5" />
                パスワード変更
              </h3>
              {!isEditingPassword && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingPassword(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  変更
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-4">
            {isEditingPassword ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">新しいパスワード</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新しいパスワードを入力（6文字以上）"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">パスワード確認</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="パスワードを再入力"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
                    <X className="h-4 w-4 mr-1" />
                    キャンセル
                  </Button>
                  <Button onClick={handleSavePassword} disabled={isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    {isPending ? '保存中...' : '変更する'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                パスワードを変更するには「変更」ボタンをクリックしてください。
              </p>
            )}
          </CardContent>
        </Card>

        {/* パーソナルカラー設定カード */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Palette className="h-5 w-5" />
                パーソナルカラー
              </h3>
              {!isEditingColor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingColor(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  変更
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-4">
            {isEditingColor ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  掃除当番カレンダーなどで表示される、あなた専用の色を設定できます。
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">パーソナルカラー</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={colorToHex(editPersonalColor)}
                      onChange={(e) => setEditPersonalColor(e.target.value)}
                      className="w-20 h-20 rounded-lg border-2 border-slate-300 cursor-pointer overflow-hidden"
                      style={{
                        backgroundColor: colorToHex(editPersonalColor),
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        padding: 0,
                      }}
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        type="text"
                        value={editPersonalColor}
                        onChange={(e) => setEditPersonalColor(e.target.value)}
                        placeholder="例: hsl(210, 70%, 80%) or #87CEEB"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateRandomColor}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        ランダムに生成
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    カラーピッカーで選択するか、HSL形式またはhex形式で直接入力できます
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEdit} disabled={isPending}>
                    <X className="h-4 w-4 mr-1" />
                    キャンセル
                  </Button>
                  <Button onClick={handleSavePersonalColor} disabled={isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    {isPending ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-slate-200 shadow-sm"
                  style={{ backgroundColor: profile.personal_color || '#e2e8f0' }}
                />
                <div>
                  <p className="text-sm text-slate-600">
                    {profile.personal_color ? '設定済み' : '未設定（グレーで表示されます）'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    掃除当番カレンダーで、あなたの当番日がこの色で表示されます。
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ポイントカード */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">ポイント</h3>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            {/* 今月と累計 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-pink-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-pink-600 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span>今月</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Heart className="h-5 w-5 fill-pink-500 text-pink-500" />
                  <span className="text-2xl font-bold text-pink-600">{monthlyPoints}</span>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-amber-600 mb-1">
                  <Trophy className="h-4 w-4" />
                  <span>累計</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Heart className="h-5 w-5 fill-amber-500 text-amber-500" />
                  <span className="text-2xl font-bold text-amber-600">{profile.current_points}</span>
                </div>
              </div>
            </div>

            <h4 className="text-sm font-medium text-slate-700">ポイント獲得ルール</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg p-3">
                <span className="font-medium text-green-700">確認した</span>
                <span className="ml-2 text-green-600">+1pt</span>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <span className="font-medium text-blue-700">作業中</span>
                <span className="ml-2 text-blue-600">+5pt</span>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <span className="font-medium text-purple-700">解決済み</span>
                <span className="ml-2 text-purple-600">+10pt</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ポイント履歴カード */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">ポイント履歴（直近10件）</h3>
          </CardHeader>
          <CardContent className="py-4">
            {pointHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                ポイント履歴がありません
              </div>
            ) : (
              <div className="space-y-3">
                {pointHistory.slice(0, 10).map((log, index) => (
                  <div 
                    key={log.point_log_id || index} 
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {log.amount > 0 ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                          <ArrowUp className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <ArrowDown className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800">
                          {replaceStatusTags(log.reason)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(log.created_at)} {formatTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      'font-semibold text-lg',
                      log.amount > 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {log.amount > 0 ? '+' : ''}{log.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
