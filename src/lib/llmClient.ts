const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.LLM_MODEL || "gemini-3.5-flash-lite";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

export class LLMError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls Gemini with a prompt, asking for JSON output directly (Gemini
 * supports responseMimeType: "application/json", which meaningfully
 * reduces malformed-output retries compared to asking in plain text).
 * Retries with exponential backoff specifically on 429 (rate limit) and
 * 503 (transient overload), this is the behavior the brief explicitly
 * warns most people skip and then lose points over.
 */
export async function callLLM(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new LLMError("MISSING_API_KEY", "GEMINI_API_KEY is not set");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
      });

      clearTimeout(timeout);

      if (response.status === 429 || response.status === 503) {
        const retryAfterHeader = response.headers.get("retry-after");
        const delay = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : BASE_DELAY_MS * 2 ** attempt;
        lastError = new LLMError(
          "RATE_LIMITED",
          `Provider returned ${response.status}, backing off ${delay}ms`,
        );
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new LLMError(
          "PROVIDER_ERROR",
          `Gemini returned ${response.status}: ${body.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string" || text.length === 0) {
        throw new LLMError("EMPTY_RESPONSE", "Gemini returned no text content");
      }
      return text;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof LLMError) throw err;
      if ((err as Error).name === "AbortError") {
        lastError = new LLMError(
          "TIMEOUT",
          `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
      } else {
        lastError = err as Error;
      }
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw (
    lastError ??
    new LLMError("UNKNOWN_ERROR", "LLM call failed for an unknown reason")
  );
}
