import { KitStatus } from "@/lib/types";

const STATUS_CONFIG: Record<KitStatus, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-ink-faint/20 text-ink-muted" },
  generating: { label: "Generating", className: "bg-amber/20 text-amber" },
  ready: { label: "Ready", className: "bg-sage/20 text-sage" },
  failed: { label: "Failed", className: "bg-coral/20 text-coral" },
};

export function StatusBadge({ status }: { status: KitStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
