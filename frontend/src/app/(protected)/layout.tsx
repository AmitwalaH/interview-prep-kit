"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { AppShell } from "@/components/AppShell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once the initial /me check has actually resolved —
    // redirecting while still loading would bounce a signed-in user on
    // every page refresh, since `user` starts null before the check runs.
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // redirect is in flight
  }

  return <AppShell>{children}</AppShell>;
}
