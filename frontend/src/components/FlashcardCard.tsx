"use client";

import { useState } from "react";
import { Flashcard } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface FlashcardCardProps {
  flashcard: Flashcard;
  onSave: (patch: { front: string; back: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onTogglePin: () => Promise<void>;
}

export function FlashcardCard({ flashcard, onSave, onDelete, onTogglePin }: FlashcardCardProps) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ front, back });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {flashcard.status === "pinned" && (
            <span className="rounded bg-amber/20 px-2 py-0.5 text-xs font-medium text-amber">Pinned</span>
          )}
          {flashcard.status === "edited" && (
            <span className="rounded bg-sage/20 px-2 py-0.5 text-xs font-medium text-sage">Edited</span>
          )}
          {flashcard.practice.times_practiced > 0 && (
            <span className="text-xs text-ink-faint">Practiced {flashcard.practice.times_practiced}×</span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onTogglePin}>
            {flashcard.status === "pinned" ? "Unpin" : "Pin"}
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-coral hover:text-coral"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <Textarea label="Front" rows={2} value={front} onChange={(e) => setFront(e.target.value)} />
          <Textarea label="Back" rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
          <Button onClick={handleSave} loading={saving} className="w-fit">
            Save
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink">{flashcard.front}</p>
          <p className="mt-1 text-sm text-ink-muted">{flashcard.back}</p>
        </div>
      )}
    </div>
  );
}
