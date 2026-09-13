"use client";

import Link from "next/link";
import { useState } from "react";
import { KitDocument } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/Button";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function KitCard({
  kit,
  onDelete,
}: {
  kit: KitDocument;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); // don't navigate via the wrapping Link
    e.stopPropagation();
    if (!window.confirm("Delete this kit? This can't be undone.")) return;
    setDeleting(true);
    try {
      await onDelete(kit.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Link
      href={`/kits/${kit.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-medium text-ink">
            {hostnameOf(kit.input.company_url)}
          </p>
          <p className="text-xs text-ink-muted">
            {kit.input.days} day{kit.input.days === 1 ? "" : "s"} to prepare
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={kit.status} />
        <span className="hidden text-xs text-ink-faint sm:inline">
          {relativeTime(kit.createdAt)}
        </span>
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs text-coral hover:text-coral"
          onClick={handleDelete}
          loading={deleting}
        >
          Delete
        </Button>
      </div>
    </Link>
  );
}
