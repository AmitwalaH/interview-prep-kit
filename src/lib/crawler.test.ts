import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { scoreLink, crawlCompanySite } from "./crawler";

const {
  startFixtureServer,
} = require("../../test-fixtures/fake-company-site.js");

describe("scoreLink", () => {
  it("scores a /careers link highly", () => {
    expect(scoreLink("/careers", "Careers")).toBeGreaterThanOrEqual(10);
  });

  it("scores an unrelated link at zero", () => {
    expect(scoreLink("/contact", "Contact")).toBe(0);
  });

  it("scores a non-obvious hiring page path via anchor text, proving it isn't a fixed path list", () => {
    expect(scoreLink("/life-at-acme", "Life at Acme")).toBeGreaterThan(0);
  });

  it("scores a blog link low but non-zero", () => {
    const score = scoreLink("/blog", "Engineering Blog");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(scoreLink("/careers", "Careers"));
  });
});

describe("crawlCompanySite (integration, against a real local server)", () => {
  const PORT = 8098;
  let server: any;

  beforeAll(async () => {
    server = await startFixtureServer(PORT);
  });

  afterAll(() => {
    server.close();
  });

  it("finds the buried hiring page without any hardcoded path", async () => {
    const result = await crawlCompanySite(`http://localhost:${PORT}/`);
    expect(result.pagesUsed.some((u) => u.includes("/life-at-acme"))).toBe(
      true,
    );
    expect(result.hiringProcessText).toContain("recruiter screen");
    expect(result.hiringProcessText).toContain("system design");
  });

  it("captures company description text from the homepage", async () => {
    const result = await crawlCompanySite(`http://localhost:${PORT}/`);
    expect(result.companyText).toContain("developer tools");
  });

  it("respects robots.txt and never fetches a disallowed path", async () => {
    const result = await crawlCompanySite(`http://localhost:${PORT}/`);
    expect(result.pagesUsed.some((u) => u.includes("/contact"))).toBe(false);
  });

  it("reports an unreachable homepage as a recorded failure, not a thrown error", async () => {
    const result = await crawlCompanySite(
      `http://localhost:${PORT}/nonexistent-path-that-404s`,
    );
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.pagesUsed).toEqual([]);
  });

  it("reports an entirely unreachable host as a recorded failure, not a thrown error", async () => {
    const result = await crawlCompanySite("http://localhost:1/"); // nothing listens here
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.companyText).toBe("");
  });
});
