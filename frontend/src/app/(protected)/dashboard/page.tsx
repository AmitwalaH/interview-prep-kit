"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { KitDocument } from "@/lib/types";
import { KitCard } from "@/components/KitCard";
import { Button } from "@/components/ui/Button";
import { deleteKit } from "@/lib/kitApi";

type LoadState = "loading" | "loaded" | "error";

export default function DashboardPage() {
  const [kits, setKits] = useState<KitDocument[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<KitDocument[]>("/api/kits");
      setKits(data);
      setState("loaded");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still in flight, so status flips from
  // pending/generating to ready/failed without a manual refresh.
  useEffect(() => {
    const inFlight = kits.some(
      (k) => k.status === "pending" || k.status === "generating",
    );
    if (!inFlight) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [kits, load]);

  async function handleDelete(id: string) {
    await deleteKit(id);
    setKits((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Your kits
        </h1>
        <Link href="/kits/new">
          <Button>New kit</Button>
        </Link>
      </div>

      <div className="mt-6">
        {state === "loading" && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-border bg-surface"
              />
            ))}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-lg border border-coral/40 bg-coral/5 px-4 py-6 text-center">
            <p className="text-sm text-coral">
              Couldn&apos;t load your kits. Check your connection and try again.
            </p>
            <Button variant="secondary" className="mt-3" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {state === "loaded" && kits.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <p className="text-sm text-ink-muted">
              No kits yet — paste a job description to build your first one.
            </p>
            <Link href="/kits/new">
              <Button className="mt-4">Create your first kit</Button>
            </Link>
          </div>
        )}

        {state === "loaded" && kits.length > 0 && (
          <div className="flex flex-col gap-2">
            {kits.map((kit) => (
              <KitCard key={kit.id} kit={kit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
