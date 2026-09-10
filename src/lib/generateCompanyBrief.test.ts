import { describe, it, expect, vi } from "vitest";
import { generateCompanyBrief } from "./generateCompanyBrief";
import { PipelineError } from "./errors";
import { LLMError } from "./llmClient";

describe("generateCompanyBrief", () => {
  it("makes ZERO llm calls and returns an honest fallback when companyText is empty", async () => {
    const mockLlm = vi.fn();
    const result = await generateCompanyBrief("", mockLlm);
    expect(mockLlm).not.toHaveBeenCalled();
    expect(result.summary).toMatch(/no public information/i);
  });

  it("makes zero calls for whitespace-only companyText too", async () => {
    const mockLlm = vi.fn();
    await generateCompanyBrief("   \n  ", mockLlm);
    expect(mockLlm).not.toHaveBeenCalled();
  });

  it("returns the parsed brief when companyText is real and the LLM responds validly", async () => {
    const mockLlm = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          summary: "Acme builds dev tools.",
          what_they_do: "Developer tooling.",
        }),
      );
    const result = await generateCompanyBrief(
      "Acme builds developer tools for backend teams.",
      mockLlm,
    );
    expect(result.summary).toBe("Acme builds dev tools.");
  });

  it("falls back honestly (does not throw) if the LLM returns malformed JSON", async () => {
    const mockLlm = vi.fn().mockResolvedValue("not json");
    const result = await generateCompanyBrief(
      "Acme builds developer tools.",
      mockLlm,
    );
    expect(result.summary).toMatch(/no public information/i);
  });

  it("propagates a rate-limit error as a PipelineError rather than silently falling back", async () => {
    const mockLlm = vi
      .fn()
      .mockRejectedValue(new LLMError("RATE_LIMITED", "slow down"));
    await expect(
      generateCompanyBrief("Acme builds developer tools.", mockLlm),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});
