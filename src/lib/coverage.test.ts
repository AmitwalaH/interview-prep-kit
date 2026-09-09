import { describe, it, expect } from "vitest";
import { checkCoverage, uncoveredMustHaves } from "./coverage";
import { Requirement, Question } from "./schema";

function req(id: string, priority: "must" | "nice" = "must"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirement_ids: string[]): Question {
  return {
    id,
    requirement_ids,
    category: "technical",
    prompt: `question ${id}`,
    answer_outline: "",
    difficulty: 2,
  };
}

describe("checkCoverage", () => {
  it("returns no gaps when every requirement has a question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    expect(
      checkCoverage(requirements, questions).uncovered_requirement_ids,
    ).toEqual([]);
  });

  it("flags a requirement with zero questions against it", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"])];
    expect(
      checkCoverage(requirements, questions).uncovered_requirement_ids,
    ).toEqual(["r2"]);
  });

  it("counts a requirement as covered even if only referenced alongside others on one question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1", "r2"])];
    expect(
      checkCoverage(requirements, questions).uncovered_requirement_ids,
    ).toEqual([]);
  });

  it("returns all requirement ids as uncovered when there are no questions at all", () => {
    const requirements = [req("r1"), req("r2")];
    expect(checkCoverage(requirements, []).uncovered_requirement_ids).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("returns empty when there are no requirements", () => {
    expect(checkCoverage([], []).uncovered_requirement_ids).toEqual([]);
  });
});

describe("uncoveredMustHaves", () => {
  it("ignores gaps on nice-to-have requirements", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions: Question[] = []; // nothing covered at all
    expect(uncoveredMustHaves(requirements, questions)).toEqual(["r1"]);
  });

  it("returns empty once the must-have gap is filled, even if a nice-to-have gap remains", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [q("q1", ["r1"])];
    expect(uncoveredMustHaves(requirements, questions)).toEqual([]);
  });
});
