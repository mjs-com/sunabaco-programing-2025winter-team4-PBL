import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * サーバーサイド用Supabaseクライアント
 * Server Components, Server Actions, Route Handlersで使用
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Componentから呼ばれた場合はcookieを設定できないので無視
          }
        },
      },
    }
  );
}

