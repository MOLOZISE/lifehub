"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { migrateLocalStorageToDB, isMigrated } from "@/lib/migrate";
import { toast } from "sonner";

export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const ranRef = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || ranRef.current) return;
    if (isMigrated(userId)) return;

    ranRef.current = true;

    migrateLocalStorageToDB(userId).then((result) => {
      if (result.success && result.message !== "이미 마이그레이션 완료" && result.message !== "마이그레이션할 데이터 없음") {
        toast.success("기존 데이터를 클라우드에 동기화했습니다.", { duration: 4000 });
      }
    });
  }, [session?.user?.id]);

  return <>{children}</>;
}
