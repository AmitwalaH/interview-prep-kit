import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const {
  startFixtureServer,
} = require("../../test-fixtures/fake-company-site.js");

vi.mock("./llmClient", () => ({
  callLLM: vi.fn().mockResolvedValue(
    JSON.stringify({
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Build backend services"],
      requirements: [
        { text: "5+ years of Node.js", kind: "technical", priority: "must" },
      ],
    }),
  ),
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
    const kit = await generateKit({
      id: "test-case",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://localhost:${PORT}/`,
      days: 5,
    });

    // The fixture server has a /life-at-acme page, which is the buried hiring page
    expect(kit.source.pages_used.some((u) => u.includes(`:${PORT}/`))).toBe(
      true,
    );
    expect(kit.source.pages_used.some((u) => u.includes("life-at-acme"))).toBe(
      true,
    );
  });

  it("wires real extraction results into role.requirements", async () => {
    const { generateKit } = await import("./pipeline");
    const kit = await generateKit({
      id: "test-case-2",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://localhost:${PORT}/`,
      days: 5,
    });

    expect(kit.role.requirements).toHaveLength(1);
    expect(kit.role.requirements[0].priority).toBe("must");
  });

  it("correctly reports every requirement as uncovered, since no questions exist yet", async () => {
    const { generateKit } = await import("./pipeline");
    const kit = await generateKit({
      id: "test-case-3",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: `http://localhost:${PORT}/`,
      days: 5,
    });

    expect(kit.coverage.uncovered_requirement_ids).toEqual(["r1"]);
  });

  it("still produces a valid kit even when the crawl target is entirely unreachable", async () => {
    const { generateKit } = await import("./pipeline");
    const kit = await generateKit({
      id: "test-case-4",
      jd: "Senior Backend Engineer, 5+ years Node.js",
      company_url: "http://localhost:1/", // nothing listens here
      days: 5,
    });

    expect(kit.source.pages_used).toEqual([]);
    expect(kit.role.requirements).toHaveLength(1); // extraction still works, even if crawling fails
  });
});
