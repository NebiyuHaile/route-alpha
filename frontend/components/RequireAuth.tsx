"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isReady, pathname, router]);

  if (!isReady) {
    return (
      <main className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-sm">
          <div className="space-y-3">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-9 w-64 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-52 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
