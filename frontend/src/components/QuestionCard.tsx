"use client";

import { useState } from "react";
import { Question } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

interface QuestionCardProps {
  question: Question;
  onSave: (patch: { prompt: string; answer_outline: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onTogglePin: () => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function QuestionCard({
  question,
  onSave,
  onDelete,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: QuestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [answerOutline, setAnswerOutline] = useState(question.answer_outline);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ prompt, answer_outline: answerOutline });
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
      setDeleting(false); // stayed in the list, let the user try again
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
            {DIFFICULTY_LABEL[question.difficulty]}
          </span>
          {question.status === "pinned" && (
            <span className="rounded bg-amber/20 px-2 py-0.5 text-xs font-medium text-amber">Pinned</span>
          )}
          {question.status === "edited" && (
            <span className="rounded bg-sage/20 px-2 py-0.5 text-xs font-medium text-sage">Edited</span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onMoveUp} disabled={isFirst} aria-label="Move up">
            ↑
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onMoveDown} disabled={isLast} aria-label="Move down">
            ↓
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onTogglePin}>
            {question.status === "pinned" ? "Unpin" : "Pin"}
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
          <Textarea label="Question" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Textarea
            label="Answer outline"
            rows={3}
            value={answerOutline}
            onChange={(e) => setAnswerOutline(e.target.value)}
          />
          <Button onClick={handleSave} loading={saving} className="w-fit">
            Save
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink">{question.prompt}</p>
          <p className="mt-2 text-sm text-ink-muted">{question.answer_outline}</p>
        </div>
      )}
    </div>
  );
}
