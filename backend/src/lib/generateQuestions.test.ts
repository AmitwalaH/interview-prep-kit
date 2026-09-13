import { describe, it, expect, vi } from "vitest";
import { generateQuestionsAndFlashcards } from "./generateQuestions";
import { PipelineError } from "./errors";
import { LLMError } from "./llmClient";
import { Requirement } from "./schema";

function req(id: string): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority: "must" };
}

function validResponse(requirementId: string | null = "r1") {
  return JSON.stringify([
    {
      requirement_id: requirementId,
      prompt: "Explain X",
      answer_outline: "Cover A, B, C",
      difficulty: 2,
      flashcard_front: "What is X?",
      flashcard_back: "X is...",
    },
  ]);
}

describe("generateQuestionsAndFlashcards", () => {
  it("assigns ids starting from q1/f1 when no existing ids are given", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse("r1"));
    const { questions, flashcards } = await generateQuestionsAndFlashcards(
      "technical",
      [req("r1")],
      "",
      mockLlm,
    );
    expect(questions[0].id).toBe("q1");
    expect(questions[0].requirement_ids).toEqual(["r1"]);
    expect(flashcards[0].id).toBe("f1");
    expect(flashcards[0].requirement_ids).toEqual(["r1"]);
  });

  it("continues numbering from the highest existing id when seeded explicitly", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse("r1"));
    const second = await generateQuestionsAndFlashcards(
      "behavioural",
      [req("r1")],
      "",
      mockLlm,
      {
        questionIds: ["q1", "q2"],
        flashcardIds: ["f1", "f2"],
      },
    );
    expect(second.questions[0].id).toBe("q3");
    expect(second.flashcards[0].id).toBe("f3");
  });

  it("never collides with existing ids even when called with an EMPTY seed after other kits used higher numbers", async () => {
    // This is the exact bug this design fixes: no shared global counter,
    // so a call with no seed always starts at q1/f1 regardless of what
    // any other kit or earlier call produced.
    const mockLlm = vi.fn().mockResolvedValue(validResponse("r1"));
    const result = await generateQuestionsAndFlashcards(
      "technical",
      [req("r1")],
      "",
      mockLlm,
    );
    expect(result.questions[0].id).toBe("q1");
  });

  it("ignores non-numeric suffixes (hand-added ids like q_ab12cd34) when computing the next number", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse("r1"));
    const result = await generateQuestionsAndFlashcards(
      "technical",
      [req("r1")],
      "",
      mockLlm,
      {
        questionIds: ["q_ab12cd34", "q5"],
        flashcardIds: [],
      },
    );
    expect(result.questions[0].id).toBe("q6");
  });

  it("drops a hallucinated requirement_id rather than trusting it", async () => {
    const mockLlm = vi
      .fn()
      .mockResolvedValue(validResponse("r999-does-not-exist"));
    const { questions } = await generateQuestionsAndFlashcards(
      "technical",
      [req("r1")],
      "",
      mockLlm,
    );
    expect(questions[0].requirement_ids).toEqual([]);
  });

  it("accepts a null requirement_id (expected for company-fit questions)", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse(null));
    const { questions } = await generateQuestionsAndFlashcards(
      "company-fit",
      [],
      "some company text",
      mockLlm,
    );
    expect(questions[0].requirement_ids).toEqual([]);
    expect(questions[0].category).toBe("company-fit");
  });

  it("retries once on malformed JSON and succeeds on the retry", async () => {
    const mockLlm = vi
      .fn()
      .mockResolvedValueOnce("garbage")
      .mockResolvedValueOnce(validResponse("r1"));
    const { questions } = await generateQuestionsAndFlashcards(
      "technical",
      [req("r1")],
      "",
      mockLlm,
    );
    expect(mockLlm).toHaveBeenCalledTimes(2);
    expect(questions).toHaveLength(1);
  });

  it("throws PipelineError after exhausting retries on persistent malformed JSON", async () => {
    const mockLlm = vi.fn().mockResolvedValue("still garbage");
    await expect(
      generateQuestionsAndFlashcards("technical", [req("r1")], "", mockLlm),
    ).rejects.toThrow(PipelineError);
  });

  it("propagates a rate-limit error as a PipelineError with the same code", async () => {
    const mockLlm = vi
      .fn()
      .mockRejectedValue(new LLMError("RATE_LIMITED", "slow down"));
    await expect(
      generateQuestionsAndFlashcards("technical", [req("r1")], "", mockLlm),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
