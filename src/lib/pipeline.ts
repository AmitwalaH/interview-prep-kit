import { Kit, validateKit } from "./schema";
import { PipelineError } from "./errors";
import { extractRoleAndRequirements } from "./extractRequirements";
import { crawlCompanySite } from "./crawler";
import { checkCoverage } from "./coverage";
import { allocateSchedule } from "./schedule";

export interface KitCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export { PipelineError };

/**
 * Produces one kit for one case. This is the ONLY pipeline implementation
 * in the codebase.
 */
export async function generateKit(kitCase: KitCase): Promise<Kit> {
  if (!kitCase.jd || kitCase.jd.trim().length === 0) {
    throw new PipelineError(
      "EMPTY_JOB_DESCRIPTION",
      "Job description is empty",
    );
  }
  if (!kitCase.days || kitCase.days < 1) {
    throw new PipelineError("INVALID_DAYS", "days must be a positive integer");
  }

  // Crawl and extract in parallel, since they are independent and both can be slow.
  const [extraction, crawlResult] = await Promise.all([
    extractRoleAndRequirements(kitCase.jd),
    crawlCompanySite(kitCase.company_url),
  ]);

  const questions: Kit["questions"] = [];
  const flashcards: Kit["flashcards"] = [];

  const coverage = checkCoverage(extraction.requirements, questions);
  const schedule = allocateSchedule(
    questions,
    extraction.requirements,
    kitCase.days,
  );

  const candidateKit = {
    source: {
      company: "",
      company_url: kitCase.company_url,
      role: extraction.title,
      location: "",
      jd_chars: kitCase.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawlResult.pagesUsed,
    },
    company_brief: {
      summary: "",
      what_they_do: "",
      sources: [],
    },
    role: {
      title: extraction.title,
      seniority: extraction.seniority,
      responsibilities: extraction.responsibilities,
      requirements: extraction.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: {
      uncovered_requirement_ids: coverage.uncovered_requirement_ids,
      passes: 0,
    },
  };

  const result = validateKit(candidateKit);
  if (!result.ok) {
    // This is a developer error, not a user error, so we throw an exception rather than
    throw new PipelineError(
      "INTERNAL_SCHEMA_MISMATCH",
      `Generated kit failed validation: ${result.errors.join("; ")}`,
    );
  }

  return result.kit;
}
