import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const {
  startFixtureServer,
} = require("../../test-fixtures/fake-company-site.js");

// Mock the LLM client so we can run integration tests with a real crawler and real fixture server,
// but without actually calling the LLM.
vi.mock("./llmClient", () => ({
  callLLM: vi.fn().mockImplementation(async (prompt: string) => {
    if (prompt.includes("extract structured information")) {
      return JSON.stringify({
        title: "Senior Backend Engineer",
        seniority: "Senior",
        responsibilities: ["Build backend services"],
        requirements: [
          { text: "5+ years of Node.js", kind: "technical", priority: "must" },
        ],
      });
    }
    if (prompt.includes("Summarize this company")) {
      return JSON.stringify({
        summary: "Acme builds dev tools.",
        what_they_do: "Developer tooling.",
      });
    }
    if (prompt.startsWith("You are generating")) {
      // Cover requirement r1 so coverage/schedule have something real to work with.
      const isCompanyFit = prompt.startsWith("You are generating company-fit");
      return JSON.stringify([
        {
          requirement_id: isCompanyFit ? null : "r1",
          prompt: "Explain how you'd design a rate limiter.",
          answer_outline: "Token bucket, sliding window, etc.",
          difficulty: 2,
          flashcard_front: "Rate limiter approach?",
          flashcard_back: "Token bucket or sliding window.",
        },
      ]);
    }
    throw new Error(`Unexpected prompt in test mock: ${prompt.slice(0, 80)}`);
  }),
  LLMError: class LLMError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

describe("generateKit (integration: real crawler + real fixture server, mocked LLM)", () => {
  const PORT = 8094;
  let server: any;

  beforeAll(async () => {
    server = await startFixtureServer(PORT);
  });

  afterAll(() => {
    server.close();
  });

  it("wires real crawl results into the final kit's pages_used", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    // The fixture site has a link to a page on life-at-acme.com, 
    // so the crawler should have followed it and included it in pages_used.
    expect(kit.source.pages_used.some((u) => u.includes(`:${PORT}/`))).toBe(
      true,
    );
    expect(kit.source.pages_used.some((u) => u.includes("life-at-acme"))).toBe(
      true,
    );
  });

  it("wires real extraction results into role.requirements", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-2",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    expect(kit.role.requirements).toHaveLength(1);
    expect(kit.role.requirements[0].priority).toBe("must");
  });

  it("generates real questions that cover the extracted requirement", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-3",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    expect(kit.questions.length).toBeGreaterThan(0);
    expect(kit.coverage.uncovered_requirement_ids).toEqual([]);
    expect(kit.coverage.passes).toBe(1); // covered on the first pass, no gap-fill needed
  });

  it("includes a company-fit question, since the fixture site has real company text", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-5",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    expect(kit.questions.some((q) => q.category === "company-fit")).toBe(true);
  });

  it("populates the company brief from real crawled text", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-6",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    expect(kit.company_brief.summary).toBe("Acme builds dev tools.");
  });

  it("allocates the real generated questions into the schedule", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-7",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://127.0.0.1:${PORT}/`,
      days: 5,
    });

    const scheduledQuestionIds = kit.schedule.days.flatMap(
      (d) => d.question_ids,
    );
    expect(scheduledQuestionIds.length).toBe(kit.questions.length);
  });

  it("still produces a valid kit, with no company-fit questions and an honest empty brief, when the crawl target is entirely unreachable", async () => {
    const { generateKit } = await import("./pipeline");
    const { kit } = await generateKit({
      id: "test-case-4",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: "http://127.0.0.1:1/", // nothing listens here
      days: 5,
    });

    expect(kit.source.pages_used).toEqual([]);
    expect(kit.role.requirements).toHaveLength(1); // extraction is independent, still succeeds
    expect(kit.questions.some((q) => q.category === "company-fit")).toBe(false);
    expect(kit.company_brief.summary).toMatch(/no public information/i);
  });
});
