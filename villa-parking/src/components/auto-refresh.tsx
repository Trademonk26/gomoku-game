"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Phase 1 실시간 대체: 주기적으로 서버 데이터를 다시 가져온다. */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
