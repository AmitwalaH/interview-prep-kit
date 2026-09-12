"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/Button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-heading text-lg font-semibold text-ink">
            Interview Prep Kit
          </Link>
          <div className="flex items-center gap-4">
            {user && <span className="hidden text-sm text-ink-muted sm:inline">{user.email}</span>}
            <Button variant="ghost" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
