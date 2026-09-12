import { describe, it, expect } from "vitest";
import {
  mergeCategoryRegeneration,
  pruneScheduleReferences,
} from "./regenerateMerge";
import { Question, Flashcard } from "./schema";

function q(
  id: string,
  category: Question["category"],
  status: Question["status"] = "generated",
  difficulty: 1 | 2 | 3 = 1,
): Question {
  return {
    id,
    requirement_ids: [],
    category,
    prompt: `p-${id}`,
    answer_outline: "",
    difficulty,
    status,
  };
}

function f(
  id: string,
  sourceQuestionId: string | null,
  status: Flashcard["status"] = "generated",
): Flashcard {
  return {
    id,
    front: `f-${id}`,
    back: "b",
    requirement_ids: [],
    status,
    source_question_id: sourceQuestionId,
    practice: { confidence: null, times_practiced: 0, last_practiced_at: null },
  };
}

describe("mergeCategoryRegeneration", () => {
  it("replaces a generated-status question in the target category with fresh ones", () => {
    const existing = [q("q1", "technical", "generated")];
    const fresh = [q("q99", "technical", "generated")];
    const result = mergeCategoryRegeneration(
      existing,
      [],
      "technical",
      fresh,
      [],
    );
    expect(result.questions.map((x) => x.id)).toEqual(["q99"]);
  });

  it("preserves an EDITED question in the target category, does not replace it", () => {
    const existing = [q("q1", "technical", "edited")];
    const fresh = [q("q99", "technical", "generated")];
    const result = mergeCategoryRegeneration(
      existing,
      [],
      "technical",
      fresh,
      [],
    );
    const ids = result.questions.map((x) => x.id);
    expect(ids).toContain("q1");
    expect(ids).toContain("q99");
  });

  it("preserves a PINNED question in the target category", () => {
    const existing = [q("q1", "technical", "pinned")];
    const fresh: Question[] = [];
    const result = mergeCategoryRegeneration(
      existing,
      [],
      "technical",
      fresh,
      [],
    );
    expect(result.questions.map((x) => x.id)).toEqual(["q1"]);
  });

  it("never touches questions in a different category", () => {
    const existing = [
      q("q1", "behavioural", "generated"),
      q("q2", "technical", "generated"),
    ];
    const fresh = [q("q99", "technical", "generated")];
    const result = mergeCategoryRegeneration(
      existing,
      [],
      "technical",
      fresh,
      [],
    );
    const ids = result.questions.map((x) => x.id);
    expect(ids).toContain("q1"); // untouched, different category
    expect(ids).not.toContain("q2"); // discarded, generated status in target category
    expect(ids).toContain("q99");
  });

  it("discards flashcards whose source question was discarded", () => {
    const existing = [q("q1", "technical", "generated")];
    const existingFlashcards = [f("f1", "q1")];
    const fresh = [q("q99", "technical", "generated")];
    const freshFlashcards = [f("f99", "q99")];
    const result = mergeCategoryRegeneration(
      existing,
      existingFlashcards,
      "technical",
      fresh,
      freshFlashcards,
    );
    expect(result.flashcards.map((x) => x.id)).toEqual(["f99"]);
  });

  it("keeps a flashcard whose source question survived (edited/pinned)", () => {
    const existing = [q("q1", "technical", "edited")];
    const existingFlashcards = [f("f1", "q1")];
    const result = mergeCategoryRegeneration(
      existing,
      existingFlashcards,
      "technical",
      [],
      [],
    );
    expect(result.flashcards.map((x) => x.id)).toEqual(["f1"]);
  });

  it("keeps a manually-added flashcard with no source question, regardless of category being regenerated", () => {
    const existingFlashcards = [f("f1", null)];
    const result = mergeCategoryRegeneration(
      [],
      existingFlashcards,
      "technical",
      [],
      [],
    );
    expect(result.flashcards.map((x) => x.id)).toEqual(["f1"]);
  });

  it("real-world scenario: mixed generated/edited/pinned survives correctly in one call", () => {
    const existing = [
      q("q1", "technical", "generated"), // discarded
      q("q2", "technical", "edited"), // survives
      q("q3", "technical", "pinned"), // survives
      q("q4", "behavioural", "generated"), // untouched, different category
    ];
    const existingFlashcards = [
      f("f1", "q1"),
      f("f2", "q2"),
      f("f3", "q3"),
      f("f4", "q4"),
    ];
    const fresh = [q("q5", "technical", "generated")];
    const freshFlashcards = [f("f5", "q5")];

    const result = mergeCategoryRegeneration(
      existing,
      existingFlashcards,
      "technical",
      fresh,
      freshFlashcards,
    );

    expect(result.questions.map((x) => x.id).sort()).toEqual([
      "q2",
      "q3",
      "q4",
      "q5",
    ]);
    expect(result.flashcards.map((x) => x.id).sort()).toEqual([
      "f2",
      "f3",
      "f4",
      "f5",
    ]);
  });
});

describe("pruneScheduleReferences", () => {
  it("strips a question id that no longer exists from a schedule day", () => {
    const days = [
      { day: 1, focus: "technical", question_ids: ["q1", "q2"], minutes: 40 },
    ];
    const survivors = [q("q1", "technical", "generated", 1)];
    const result = pruneScheduleReferences(days, survivors);
    expect(result[0].question_ids).toEqual(["q1"]);
  });

  it("recomputes minutes from only the surviving questions", () => {
    const days = [
      { day: 1, focus: "technical", question_ids: ["q1", "q2"], minutes: 65 },
    ];
    const survivors = [q("q1", "technical", "generated", 2)]; // 25 minutes per the shared mapping
    const result = pruneScheduleReferences(days, survivors);
    expect(result[0].minutes).toBe(25);
  });

  it("leaves a day untouched if all its question ids still exist", () => {
    const days = [
      { day: 1, focus: "technical", question_ids: ["q1"], minutes: 15 },
    ];
    const survivors = [q("q1", "technical", "generated", 1)];
    const result = pruneScheduleReferences(days, survivors);
    expect(result[0]).toEqual(days[0]);
  });

  it("zeroes out a day whose entire content was removed", () => {
    const days = [
      { day: 1, focus: "technical", question_ids: ["q1"], minutes: 15 },
    ];
    const result = pruneScheduleReferences(days, []); // q1 no longer exists
    expect(result[0].question_ids).toEqual([]);
    expect(result[0].minutes).toBe(0);
  });
});
