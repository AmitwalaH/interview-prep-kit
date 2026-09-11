import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchPublicDiscussion } from "./publicDiscoverySearch";

const originalFetch = global.fetch;
const originalKey = process.env.FIRECRAWL_API_KEY;

beforeEach(() => {
  process.env.FIRECRAWL_API_KEY = "fc-test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.FIRECRAWL_API_KEY = originalKey;
  vi.restoreAllMocks();
});

describe("searchPublicDiscussion", () => {
  it("makes no request at all when companyName is empty", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    const result = await searchPublicDiscussion("");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ text: "", sources: [] });
  });

  it("makes no request when FIRECRAWL_API_KEY is not set", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    const result = await searchPublicDiscussion("Acme Corp");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ text: "", sources: [] });
  });

  it("sends the API key as a Bearer token", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    global.fetch = mockFetch as any;
    await searchPublicDiscussion("Acme Corp");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer fc-test-key");
  });

  it("combines title+description from results and collects source URLs on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            title: "Acme interview experience",
            description: "3 rounds, take-home included.",
            url: "https://glassdoor.com/acme",
          },
          {
            title: "Acme onsite tips",
            description: "System design heavy.",
            url: "https://reddit.com/r/acme",
          },
        ],
      }),
    }) as any;

    const result = await searchPublicDiscussion("Acme Corp");
    expect(result.text).toContain("3 rounds");
    expect(result.text).toContain("System design heavy");
    expect(result.sources).toEqual([
      "https://glassdoor.com/acme",
      "https://reddit.com/r/acme",
    ]);
  });

  it("returns an empty result (not a throw) when the API responds with an error status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    const result = await searchPublicDiscussion("Acme Corp");
    expect(result).toEqual({ text: "", sources: [] });
  });

  it("returns an empty result (not a throw) on a network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;
    const result = await searchPublicDiscussion("Acme Corp");
    expect(result).toEqual({ text: "", sources: [] });
  });

  it("returns an empty result if the response shape is unexpected", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: true }),
    }) as any;
    const result = await searchPublicDiscussion("Acme Corp");
    expect(result).toEqual({ text: "", sources: [] });
  });
});
