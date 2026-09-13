"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as kitApi from "@/lib/kitApi";
import { Flashcard } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const CONFIDENCE_LABELS = ["Not at all", "Barely", "Somewhat", "Fairly", "Very"];

export default function PracticePage() {
  const params = useParams();
  const kitId = params.id as string;

  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [coverage, setCoverage] = useState<{ practiced: number; total: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await kitApi.getPracticeSession(kitId);
      setCards(session.order);
      setCoverage(session.coverage);
      setIndex(0);
      setRevealed(false);
      setError(false);
    } catch {
      setError(true);
    }
  }, [kitId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRate(confidence: number) {
    if (!cards) return;
    const card = cards[index];
    await kitApi.recordPractice(kitId, card.id, confidence);

    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      // Deck complete — reload to get a freshly re-ordered session
      // (least-confident-first now reflects what was just practiced).
      load();
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-coral/40 bg-coral/5 px-4 py-8 text-center">
        <p className="text-sm text-coral">Couldn&apos;t load practice session.</p>
        <Button variant="secondary" className="mt-3" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!cards) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />;
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
        <p className="text-sm text-ink-muted">No flashcards yet in this kit.</p>
        <Link href={`/kits/${kitId}`}>
          <Button variant="secondary" className="mt-4">
            Back to kit
          </Button>
        </Link>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between">
        <Link href={`/kits/${kitId}`} className="text-sm text-ink-muted hover:text-ink">
          ← Back to kit
        </Link>
        {coverage && (
          <span className="text-sm text-ink-muted">
            {coverage.practiced}/{coverage.total} covered
          </span>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Card {index + 1} of {cards.length}
      </p>

      <Card className="mt-3 flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
        <p className="font-heading text-lg text-ink">{card.front}</p>
        {revealed && <p className="mt-4 text-sm text-ink-muted">{card.back}</p>}
      </Card>

      <div className="mt-6">
        {!revealed ? (
          <Button className="w-full" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        ) : (
          <div>
            <p className="mb-2 text-center text-sm text-ink-muted">How confident did you feel?</p>
            <div className="grid grid-cols-5 gap-2">
              {CONFIDENCE_LABELS.map((label, i) => (
                <Button key={i} variant="secondary" className="flex-col text-xs" onClick={() => handleRate(i + 1)}>
                  {i + 1}
                  <span className="mt-0.5 hidden text-[10px] font-normal sm:block">{label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
