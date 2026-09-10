import { z } from "zod";
import { callLLM, LLMError } from "./llmClient";
import { PipelineError } from "./errors";

const BriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
});

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

const NO_INFO_FOUND = {
  summary:
    "No public information about this company could be found from the provided URL.",
  what_they_do: "",
};

// Generates a brief summary of the company based on the text scraped from its website.
export async function generateCompanyBrief(
  companyText: string,
  llmCall: (prompt: string) => Promise<string> = callLLM,
): Promise<{ summary: string; what_they_do: string }> {
  if (!companyText.trim()) {
    return NO_INFO_FOUND;
  }

  const prompt = `Summarize this company based ONLY on the text below, which was scraped from their own website. Do not add information not present in the text. If the text is too thin to say much, keep the summary short rather than padding it out.

<company_text>
${companyText}
</company_text>

Respond with ONLY a JSON object, no other text:
{ "summary": string, "what_they_do": string }`;

  let rawText: string;
  try {
    rawText = await llmCall(prompt);
  } catch (err) {
    if (err instanceof LLMError) throw new PipelineError(err.code, err.message);
    throw new PipelineError("LLM_CALL_FAILED", (err as Error).message);
  }

  try {
    const parsed = JSON.parse(stripCodeFence(rawText));
    const result = BriefSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // fall through to honest fallback below
  }

  // If the LLM didn't return valid JSON, or the JSON didn't match our schema,
  // we return a fallback object that indicates no information was found.
  return NO_INFO_FOUND;
}
