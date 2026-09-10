import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateQuestionsAndFlashcards,
  resetIdCounter,
} from "./generateQuestions";
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

beforeEach(() => {
  resetIdCounter();
});

describe("generateQuestionsAndFlashcards", () => {
  it("assigns sequential q/f ids and links to the correct requirement", async () => {
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

  it("continues id numbering across multiple calls rather than restarting", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse("r1"));
    await generateQuestionsAndFlashcards("technical", [req("r1")], "", mockLlm);
    const second = await generateQuestionsAndFlashcards(
      "behavioural",
      [req("r1")],
      "",
      mockLlm,
    );
    expect(second.questions[0].id).toBe("q2");
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
