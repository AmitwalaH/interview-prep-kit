import { describe, it, expect } from "vitest";
import { orderForPracticeSession, practiceCoverage } from "./practiceOrdering";
import { Flashcard } from "./schema";

function card(
  id: string,
  timesPracticed: number,
  confidence: number | null,
): Flashcard {
  return {
    id,
    front: `f-${id}`,
    back: "b",
    requirement_ids: [],
    status: "generated",
    source_question_id: null,
    practice: {
      confidence,
      times_practiced: timesPracticed,
      last_practiced_at: null,
    },
  };
}

describe("orderForPracticeSession", () => {
  it("puts never-practiced cards before practiced ones", () => {
    const cards = [card("a", 1, 5), card("b", 0, null)];
    const ordered = orderForPracticeSession(cards);
    expect(ordered[0].id).toBe("b");
  });

  it("orders practiced cards by ascending confidence (least confident first)", () => {
    const cards = [card("a", 1, 5), card("b", 1, 1), card("c", 1, 3)];
    const ordered = orderForPracticeSession(cards);
    expect(ordered.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the original array", () => {
    const cards = [card("a", 1, 5), card("b", 0, null)];
    const original = [...cards];
    orderForPracticeSession(cards);
    expect(cards).toEqual(original);
  });
});

describe("practiceCoverage", () => {
  it("counts only cards with at least one practice as covered", () => {
    const cards = [card("a", 1, 5), card("b", 0, null), card("c", 2, 3)];
    expect(practiceCoverage(cards)).toEqual({ practiced: 2, total: 3 });
  });

  it("reports zero coverage for an untouched deck", () => {
    const cards = [card("a", 0, null)];
    expect(practiceCoverage(cards)).toEqual({ practiced: 0, total: 1 });
  });
});
