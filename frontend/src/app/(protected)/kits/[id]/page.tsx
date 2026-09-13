"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  KitDocument,
  Question,
  QuestionCategory,
  Flashcard,
} from "@/lib/types";
import * as kitApi from "@/lib/kitApi";
import { QuestionCard } from "@/components/QuestionCard";
import { FlashcardCard } from "@/components/FlashcardCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

const SECTIONS = [
  "brief",
  "role",
  "questions",
  "flashcards",
  "schedule",
] as const;

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.id as string;

  const [doc, setDoc] = useState<KitDocument | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await kitApi.getKit(kitId);
      setDoc(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [kitId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!doc || (doc.status !== "pending" && doc.status !== "generating"))
      return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [doc, load]);

  function updateKit(
    updater: (
      kit: NonNullable<KitDocument["kit"]>,
    ) => NonNullable<KitDocument["kit"]>,
  ) {
    setDoc((prev) =>
      prev && prev.kit ? { ...prev, kit: updater(prev.kit) } : prev,
    );
  }

  async function handleSaveQuestion(
    question: Question,
    patch: { prompt: string; answer_outline: string },
  ) {
    const updated = await kitApi.editQuestion(kitId, question.id, patch);
    updateKit((kit) => ({
      ...kit,
      questions: kit.questions.map((q) => (q.id === updated.id ? updated : q)),
    }));
  }

  async function handleTogglePin(question: Question) {
    const updated = await kitApi.editQuestion(kitId, question.id, {
      status: question.status === "pinned" ? "edited" : "pinned",
    });
    updateKit((kit) => ({
      ...kit,
      questions: kit.questions.map((q) => (q.id === updated.id ? updated : q)),
    }));
  }

  async function handleDeleteQuestion(question: Question) {
    await kitApi.deleteQuestion(kitId, question.id);
    updateKit((kit) => ({
      ...kit,
      questions: kit.questions.filter((q) => q.id !== question.id),
    }));
  }

  async function handleMove(question: Question, direction: "up" | "down") {
    if (!doc?.kit) return;
    const all = doc.kit.questions;

    // Reordering is scoped visually to one category, but the reorder
    // endpoint takes the FULL kit ordering — so find this question's
    // neighbors within its category, then swap their positions within
    // the full array.
    const catPositions = all
      .map((q, i) => (q.category === question.category ? i : -1))
      .filter((i) => i !== -1);
    const idxWithinCat = catPositions.findIndex(
      (pos) => all[pos].id === question.id,
    );
    const swapIdxWithinCat =
      direction === "up" ? idxWithinCat - 1 : idxWithinCat + 1;
    if (swapIdxWithinCat < 0 || swapIdxWithinCat >= catPositions.length) return;

    const posA = catPositions[idxWithinCat];
    const posB = catPositions[swapIdxWithinCat];
    const finalOrder = all.map((q) => q.id);
    [finalOrder[posA], finalOrder[posB]] = [finalOrder[posB], finalOrder[posA]];

    const updated = await kitApi.reorderQuestions(kitId, finalOrder);
    updateKit((kit) => ({ ...kit, questions: updated }));
  }

  async function handleAddQuestion(category: QuestionCategory) {
    const prompt = window.prompt("Question text:");
    if (!prompt) return;
    const answerOutline = window.prompt("Answer outline (optional):") || "";
    const created = await kitApi.addQuestion(kitId, {
      category,
      prompt,
      answer_outline: answerOutline,
      difficulty: 2,
    });
    updateKit((kit) => ({ ...kit, questions: [...kit.questions, created] }));
  }

  async function handleSaveFlashcard(
    flashcard: Flashcard,
    patch: { front: string; back: string },
  ) {
    const updated = await kitApi.editFlashcard(kitId, flashcard.id, patch);
    updateKit((kit) => ({
      ...kit,
      flashcards: kit.flashcards.map((f) =>
        f.id === updated.id ? updated : f,
      ),
    }));
  }

  async function handleToggleFlashcardPin(flashcard: Flashcard) {
    const updated = await kitApi.editFlashcard(kitId, flashcard.id, {
      status: flashcard.status === "pinned" ? "edited" : "pinned",
    });
    updateKit((kit) => ({
      ...kit,
      flashcards: kit.flashcards.map((f) =>
        f.id === updated.id ? updated : f,
      ),
    }));
  }

  async function handleDeleteFlashcard(flashcard: Flashcard) {
    await kitApi.deleteFlashcard(kitId, flashcard.id);
    updateKit((kit) => ({
      ...kit,
      flashcards: kit.flashcards.filter((f) => f.id !== flashcard.id),
    }));
  }

  async function handleAddFlashcard() {
    const front = window.prompt("Flashcard front (the question):");
    if (!front) return;
    const back = window.prompt("Flashcard back (the answer):") || "";
    const created = await kitApi.addFlashcard(kitId, { front, back });
    updateKit((kit) => ({ ...kit, flashcards: [...kit.flashcards, created] }));
  }

  async function handleRegenerate(section: kitApi.RegenerateSection) {
    setRegenerating(section);
    try {
      await kitApi.regenerateSection(kitId, section);
      await load(); // full reload — regeneration can touch schedule references too
    } finally {
      setRegenerating(null);
    }
  }

  async function handleDeleteKit() {
    if (!window.confirm("Delete this kit? This can't be undone.")) return;
    await kitApi.deleteKit(kitId);
    router.push("/dashboard");
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-coral/40 bg-coral/5 px-4 py-8 text-center">
        <p className="text-sm text-coral">Couldn&apos;t load this kit.</p>
        <Button variant="secondary" className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
    );
  }

  if (doc.status === "pending" || doc.status === "generating") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-4 py-16 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        <div>
          <p className="font-heading text-lg text-ink">
            {doc.status === "pending"
              ? "Queued..."
              : "Researching and generating your kit..."}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            This can take up to a couple of minutes — crawling the company site,
            then generating questions.
          </p>
        </div>
      </div>
    );
  }

  if (doc.status === "failed" || !doc.kit) {
    return (
      <div className="rounded-lg border border-coral/40 bg-coral/5 px-4 py-8 text-center">
        <p className="text-sm text-coral">
          Generation failed: {doc.error?.message || "Unknown error"}
        </p>
        <Link href="/dashboard">
          <Button variant="secondary" className="mt-3">
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const kit = doc.kit;
  const questionsByCategory = kit.questions.reduce<Record<string, Question[]>>(
    (acc, q) => {
      (acc[q.category] ||= []).push(q);
      return acc;
    },
    {},
  );

  return (
    <div className="flex gap-8">
      <nav className="sticky top-8 hidden h-fit w-40 shrink-0 flex-col gap-1 md:flex">
        {SECTIONS.map((s) => (
          <a
            key={s}
            href={`#${s}`}
            className="rounded px-2 py-1.5 text-sm capitalize text-ink-muted hover:text-ink"
          >
            {s}
          </a>
        ))}
        <Link
          href={`/kits/${kitId}/practice`}
          className="mt-2 rounded bg-amber/10 px-2 py-1.5 text-sm text-amber"
        >
          Practice →
        </Link>
      </nav>

      <div className="min-w-0 flex-1 space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-ink">
              {kit.role.title || "Untitled role"}
            </h1>
            <p className="text-sm text-ink-muted">{kit.source.company_url}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <Button
              variant="danger"
              className="text-xs"
              onClick={handleDeleteKit}
            >
              Delete kit
            </Button>
          </div>
        </header>

        <section id="brief">
          <SectionHeader
            title="Company Brief"
            onRegenerate={() => handleRegenerate("company_brief")}
            loading={regenerating === "company_brief"}
          />
          <Card className="mt-3 p-4">
            <p className="text-sm text-ink">{kit.company_brief.summary}</p>
            {kit.company_brief.what_they_do && (
              <p className="mt-2 text-sm text-ink-muted">
                {kit.company_brief.what_they_do}
              </p>
            )}
          </Card>
        </section>

        <section id="role">
          <h2 className="font-heading text-lg font-semibold text-ink">Role</h2>
          <Card className="mt-3 p-4">
            <p className="text-sm text-ink-muted">
              {kit.role.seniority} · {kit.role.title}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {kit.role.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.priority === "must"
                        ? "bg-coral/20 text-coral"
                        : "bg-ink-faint/20 text-ink-muted"
                    }`}
                  >
                    {r.priority}
                  </span>
                  <span className="text-ink">{r.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="questions">
          <h2 className="font-heading text-lg font-semibold text-ink">
            Questions
          </h2>
          <div className="mt-3 flex flex-col gap-6">
            {(Object.keys(CATEGORY_LABEL) as QuestionCategory[])
              .filter((cat) => questionsByCategory[cat]?.length)
              .map((cat) => (
                <div key={cat}>
                  <SectionHeader
                    title={CATEGORY_LABEL[cat]}
                    small
                    onRegenerate={() => handleRegenerate(cat)}
                    loading={regenerating === cat}
                  />
                  <div className="mt-2 flex flex-col gap-2">
                    {questionsByCategory[cat].map((q, i) => (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        onSave={(patch) => handleSaveQuestion(q, patch)}
                        onDelete={() => handleDeleteQuestion(q)}
                        onTogglePin={() => handleTogglePin(q)}
                        onMoveUp={() => handleMove(q, "up")}
                        onMoveDown={() => handleMove(q, "down")}
                        isFirst={i === 0}
                        isLast={i === questionsByCategory[cat].length - 1}
                      />
                    ))}
                    <Button
                      variant="secondary"
                      className="w-fit text-xs"
                      onClick={() => handleAddQuestion(cat)}
                    >
                      + Add question
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section id="flashcards">
          <h2 className="font-heading text-lg font-semibold text-ink">
            Flashcards
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {kit.flashcards.map((f) => (
              <FlashcardCard
                key={f.id}
                flashcard={f}
                onSave={(patch) => handleSaveFlashcard(f, patch)}
                onDelete={() => handleDeleteFlashcard(f)}
                onTogglePin={() => handleToggleFlashcardPin(f)}
              />
            ))}
            <Button
              variant="secondary"
              className="w-fit text-xs"
              onClick={handleAddFlashcard}
            >
              + Add flashcard
            </Button>
          </div>
        </section>

        <section id="schedule">
          <SectionHeader
            title="Schedule"
            onRegenerate={() => handleRegenerate("schedule")}
            loading={regenerating === "schedule"}
          />
          <div className="mt-3 flex flex-col gap-2">
            {kit.schedule.days.map((day) => (
              <Card
                key={day.day}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">Day {day.day}</p>
                  <p className="text-xs text-ink-muted">{day.focus}</p>
                </div>
                <span className="text-xs text-ink-faint">
                  {day.minutes} min
                </span>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  onRegenerate,
  loading,
  small,
}: {
  title: string;
  onRegenerate: () => void;
  loading: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3
        className={
          small
            ? "text-sm font-medium text-ink-muted"
            : "font-heading text-lg font-semibold text-ink"
        }
      >
        {title}
      </h3>
      <Button
        variant="ghost"
        className="text-xs"
        onClick={onRegenerate}
        loading={loading}
      >
        Regenerate
      </Button>
    </div>
  );
}
