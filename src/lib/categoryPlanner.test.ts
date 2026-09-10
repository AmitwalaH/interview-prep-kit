import { describe, it, expect } from "vitest";
import { planCategories, shouldGenerateCompanyFit } from "./categoryPlanner";
import { Requirement } from "./schema";

function req(id: string, kind: Requirement["kind"]): Requirement {
  return { id, text: `req ${id}`, kind, priority: "must" };
}

describe("planCategories", () => {
  it("includes technical when technical requirements exist", () => {
    const plans = planCategories([req("r1", "technical")], "");
    expect(plans.map((p) => p.category)).toContain("technical");
  });

  it("includes domain requirements under the technical category", () => {
    const plans = planCategories([req("r1", "domain")], "");
    const technical = plans.find((p) => p.category === "technical");
    expect(technical?.requirements.map((r) => r.id)).toEqual(["r1"]);
  });

  it("includes behavioural only when behavioural requirements exist", () => {
    const withBehavioural = planCategories([req("r1", "behavioural")], "");
    expect(withBehavioural.map((p) => p.category)).toContain("behavioural");

    const withoutBehavioural = planCategories([req("r1", "technical")], "");
    expect(withoutBehavioural.map((p) => p.category)).not.toContain(
      "behavioural",
    );
  });

  it("does NOT include system-design when hiring research says nothing about it", () => {
    const plans = planCategories(
      [req("r1", "technical")],
      "We do a recruiter call and a take-home.",
    );
    expect(plans.map((p) => p.category)).not.toContain("system-design");
  });

  it("DOES include system-design when hiring research explicitly mentions it", () => {
    const plans = planCategories(
      [req("r1", "technical")],
      "Our process includes a system design interview.",
    );
    expect(plans.map((p) => p.category)).toContain("system-design");
  });

  it("matches 'system design' even with different spacing/casing", () => {
    const plans = planCategories(
      [req("r1", "technical")],
      "a SYSTEM DESIGN round",
    );
    expect(plans.map((p) => p.category)).toContain("system-design");
  });

  it("produces no plans at all for an empty requirements list and no research", () => {
    expect(planCategories([], "")).toEqual([]);
  });
});

describe("shouldGenerateCompanyFit", () => {
  it("is false when the crawler found nothing about the company", () => {
    expect(shouldGenerateCompanyFit("")).toBe(false);
    expect(shouldGenerateCompanyFit("   ")).toBe(false);
  });

  it("is true when there is real company text to ground questions in", () => {
    expect(shouldGenerateCompanyFit("Acme builds developer tools.")).toBe(true);
  });
});
