import { Flashcard } from "./schema";

// Orders flashcards for a practice session, prioritizing unpracticed cards first, 
// then by ascending confidence (least confident first).
export function orderForPracticeSession(flashcards: Flashcard[]): Flashcard[] {
  return [...flashcards].sort((a, b) => {
    const aUnpracticed = a.practice.times_practiced === 0;
    const bUnpracticed = b.practice.times_practiced === 0;
    if (aUnpracticed && !bUnpracticed) return -1;
    if (!aUnpracticed && bUnpracticed) return 1;
    if (aUnpracticed && bUnpracticed) return 0; // stable order among untouched cards

    // Both practiced, lower confidence (less sure) comes first.
    return (a.practice.confidence ?? 0) - (b.practice.confidence ?? 0);
  });
}

/** Simple coverage summary: how much of the deck has been touched at all. */
export function practiceCoverage(flashcards: Flashcard[]): { practiced: number; total: number } {
  return {
    practiced: flashcards.filter((f) => f.practice.times_practiced > 0).length,
    total: flashcards.length,
  };
}
