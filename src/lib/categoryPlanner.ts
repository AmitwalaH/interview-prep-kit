import { Requirement } from "./schema";

export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

export interface CategoryPlan {
  category: QuestionCategory;
  requirements: Requirement[]; // the specific requirements this category's call should target
}

// Determines which categories actually get an LLM call, and which
// requirements each targets.
export function planCategories(
  requirements: Requirement[],
  hiringProcessText: string,
): CategoryPlan[] {
  const plans: CategoryPlan[] = [];

  const technicalReqs = requirements.filter(
    (r) => r.kind === "technical" || r.kind === "domain",
  );
  if (technicalReqs.length > 0) {
    plans.push({ category: "technical", requirements: technicalReqs });
  }

  const behaviouralReqs = requirements.filter((r) => r.kind === "behavioural");
  if (behaviouralReqs.length > 0) {
    plans.push({ category: "behavioural", requirements: behaviouralReqs });
  }

  // System design is a special case: it isn't tied to any specific requirement, 
  // but rather to what the hiring research says about the process.
  if (/system\s*design/i.test(hiringProcessText)) {
    plans.push({ category: "system-design", requirements: technicalReqs });
  }

  return plans;
}

// Determines whether we should generate a company-fit category, based on
// whether the crawler found any text about the company at all.
export function shouldGenerateCompanyFit(companyText: string): boolean {
  return companyText.trim().length > 0;
}
