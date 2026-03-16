import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 브라우저/서버 공용 클라이언트 (공개 데이터 조회용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 전용 관리자 클라이언트 (스토리지 관리, 어드민 작업용)
// 절대 클라이언트 컴포넌트에서 사용 금지
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
