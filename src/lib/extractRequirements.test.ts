import { describe, it, expect, vi } from "vitest";
import { extractRoleAndRequirements } from "./extractRequirements";
import { PipelineError } from "./errors";
import { LLMError } from "./llmClient";

function validResponse() {
  return JSON.stringify({
    title: "Senior Backend Engineer",
    seniority: "Senior",
    responsibilities: ["Build backend services"],
    requirements: [
      { text: "5+ years with Node.js", kind: "technical", priority: "must" },
      {
        text: "Experience mentoring juniors",
        kind: "behavioural",
        priority: "nice",
      },
    ],
  });
}

describe("extractRoleAndRequirements", () => {
  it("assigns stable, sequential ids to requirements rather than trusting the model", async () => {
    const mockLlm = vi.fn().mockResolvedValue(validResponse());
    const result = await extractRoleAndRequirements("some jd", mockLlm);
    expect(result.requirements.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(result.requirements[0].priority).toBe("must");
    expect(result.requirements[1].priority).toBe("nice");
  });

  it("strips a markdown code fence if the model wraps its JSON in one", async () => {
    const mockLlm = vi
      .fn()
      .mockResolvedValue("```json\n" + validResponse() + "\n```");
    const result = await extractRoleAndRequirements("some jd", mockLlm);
    expect(result.requirements).toHaveLength(2);
  });

  it("retries once on malformed JSON and succeeds if the retry is valid", async () => {
    const mockLlm = vi
      .fn()
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(validResponse());
    const result = await extractRoleAndRequirements("some jd", mockLlm);
    expect(mockLlm).toHaveBeenCalledTimes(2);
    expect(result.requirements).toHaveLength(2);
  });

  it("throws a PipelineError after exhausting retries on persistently malformed JSON", async () => {
    const mockLlm = vi.fn().mockResolvedValue("still not json");
    await expect(
      extractRoleAndRequirements("some jd", mockLlm),
    ).rejects.toThrow(PipelineError);
  });

  it("propagates a rate-limit error from the LLM client as a PipelineError, not a crash", async () => {
    const mockLlm = vi
      .fn()
      .mockRejectedValue(new LLMError("RATE_LIMITED", "too many requests"));
    await expect(
      extractRoleAndRequirements("some jd", mockLlm),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("accepts an honestly thin result (few or no requirements) without treating it as an error", async () => {
    const mockLlm = vi.fn().mockResolvedValue(
      JSON.stringify({
        title: "Engineer",
        seniority: "",
        responsibilities: [],
        requirements: [],
      }),
    );
    const result = await extractRoleAndRequirements(
      "Engineer wanted.",
      mockLlm,
    );
    expect(result.requirements).toEqual([]);
  });
});
