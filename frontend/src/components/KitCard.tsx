import Link from "next/link";
import { KitDocument } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

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

export function KitCard({ kit }: { kit: KitDocument }) {
  return (
    <Link
      href={`/kits/${kit.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-medium text-ink">{hostnameOf(kit.input.company_url)}</p>
          <p className="text-xs text-ink-muted">
            {kit.input.days} day{kit.input.days === 1 ? "" : "s"} to prepare
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={kit.status} />
        <span className="hidden text-xs text-ink-faint sm:inline">{relativeTime(kit.createdAt)}</span>
      </div>
    </Link>
  );
}
