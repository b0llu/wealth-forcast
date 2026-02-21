"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-context";
import { DashboardShell } from "../../components/dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  /* Auth resolving — full-screen spinner */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-border" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#ffae04]" />
          </div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  /* Not authenticated — render nothing (redirect in flight) */
  if (!user) return null;

  return <DashboardShell>{children}</DashboardShell>;
}
