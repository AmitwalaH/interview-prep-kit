const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/search";
const REQUEST_TIMEOUT_MS = 15_000; // Firecrawl search can be slower than a plain SERP call

export interface PublicDiscussionResult {
  text: string;
  sources: string[];
}

const EMPTY_RESULT: PublicDiscussionResult = { text: "", sources: [] };

// Searches for public discussion of a company's interview process, returning
export async function searchPublicDiscussion(
  companyName: string,
): Promise<PublicDiscussionResult> {
  if (!companyName.trim()) {
    return EMPTY_RESULT;
  }
  const apiKey = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return EMPTY_RESULT; // recorded as absent research, not a pipeline failure
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: `${companyName} interview process questions`,
        limit: 5,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return EMPTY_RESULT;
    }

    const data = (await response.json()) as any;
    const results: { title?: string; description?: string; url?: string }[] =
      Array.isArray(data?.data) ? data.data : [];

    const text = results
      .map((r) => [r.title, r.description].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 6000);

    const sources = results
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u));

    return { text, sources };
  } catch {
    clearTimeout(timeout);
    return EMPTY_RESULT; // recorded as absent research, not a pipeline failure
  }
}
