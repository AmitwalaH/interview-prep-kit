import { describe, it, expect } from "vitest";
import { allocateSchedule } from "./schedule";
import { Requirement, Question } from "./schema";

function req(id: string, priority: "must" | "nice" = "must"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(
  id: string,
  requirement_ids: string[],
  difficulty: 1 | 2 | 3 = 1,
): Question {
  return {
    id,
    requirement_ids,
    category: "technical",
    prompt: `question ${id}`,
    answer_outline: "",
    difficulty,
  };
}

describe("allocateSchedule", () => {
  it("produces exactly the number of days requested, regardless of content", () => {
    const result = allocateSchedule([], [], 7);
    expect(result.days).toHaveLength(7);
    expect(result.days_available).toBe(7);
  });

  it("places every question exactly once across all days", () => {
    const requirements = [req("r1"), req("r2"), req("r3")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];
    const result = allocateSchedule(questions, requirements, 3);
    const placedIds = result.days.flatMap((d) => d.question_ids);
    expect(placedIds.sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("puts every must-have requirement's question somewhere in the schedule", () => {
    const requirements = [
      req("r1", "must"),
      req("r2", "nice"),
      req("r3", "must"),
    ];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];
    const result = allocateSchedule(questions, requirements, 2);
    const placedIds = new Set(result.days.flatMap((d) => d.question_ids));
    expect(placedIds.has("q1")).toBe(true);
    expect(placedIds.has("q3")).toBe(true);
  });

  it("front-loads must-have questions ahead of nice-to-have ones", () => {
    const requirements = [req("r1", "nice"), req("r2", "must")];
    // Intentionally listed nice-to-have first to prove sorting, not input order, decides placement.
    const questions = [q("q-nice", ["r1"], 3), q("q-must", ["r2"], 1)];
    const result = allocateSchedule(questions, requirements, 2);
    expect(result.days[0].question_ids).toContain("q-must");
  });

  it("front-loads harder questions within the same priority level", () => {
    const requirements = [req("r1", "must"), req("r2", "must")];
    const questions = [q("q-easy", ["r1"], 1), q("q-hard", ["r2"], 3)];
    const result = allocateSchedule(questions, requirements, 2);
    expect(result.days[0].question_ids).toContain("q-hard");
  });

  it("computes minutes as a deterministic integer sum, never fractional", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r1"], 2)];
    const result = allocateSchedule(questions, requirements, 1);
    expect(Number.isInteger(result.days[0].minutes)).toBe(true);
    expect(result.days[0].minutes).toBeGreaterThan(0);
  });

  it("reports empty days honestly instead of fabricating content when days exceed available material", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r1"])];
    const result = allocateSchedule(questions, requirements, 5);
    const emptyDays = result.days.filter((d) => d.question_ids.length === 0);
    expect(emptyDays.length).toBeGreaterThan(0);
    expect(emptyDays[0].focus).toMatch(/insufficient content/i);
  });

  it("throws for zero or negative days rather than silently producing a broken schedule", () => {
    expect(() => allocateSchedule([], [], 0)).toThrow();
    expect(() => allocateSchedule([], [], -1)).toThrow();
  });
});
