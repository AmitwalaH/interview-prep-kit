import { Kit, validateKit, Requirement, Question, Flashcard } from "./schema";
import { PipelineError } from "./errors";
import { extractRoleAndRequirements } from "./extractRequirements";
import { crawlCompanySite } from "./crawler";
import { checkCoverage } from "./coverage";
import { allocateSchedule } from "./schedule";
import { planCategories, shouldGenerateCompanyFit } from "./categoryPlanner";
import {
  generateQuestionsAndFlashcards,
  resetIdCounter,
} from "./generateQuestions";
import { generateCompanyBrief } from "./generateCompanyBrief";

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

  // Crawl slow enough that we don't want to do it for every test, so reset the ID counter
  resetIdCounter();

  // Kick off the two independent LLM workstreams: requirement extraction and company site crawl.
  // Both are needed for the rest of the pipeline, so we can run them in parallel.
  const [extraction, crawlResult] = await Promise.all([
    extractRoleAndRequirements(kitCase.jd),
    crawlCompanySite(kitCase.company_url),
  ]);

  // Generates questions and flashcards for a set of requirements, returning the structured objects
  async function runGenerationPass(
    requirements: Requirement[],
  ): Promise<{ questions: Question[]; flashcards: Flashcard[] }> {
    const plans = planCategories(requirements, crawlResult.hiringProcessText);
    const questions: Question[] = [];
    const flashcards: Flashcard[] = [];
    for (const plan of plans) {
      const result = await generateQuestionsAndFlashcards(
        plan.category,
        plan.requirements,
        crawlResult.hiringProcessText,
      );
      questions.push(...result.questions);
      flashcards.push(...result.flashcards);
    }
    return { questions, flashcards };
  }

  async function maybeGenerateCompanyFit(): Promise<{
    questions: Question[];
    flashcards: Flashcard[];
  }> {
    if (!shouldGenerateCompanyFit(crawlResult.companyText)) {
      return { questions: [], flashcards: [] }; // nothing to ground it in, skip, don't fabricate
    }
    return generateQuestionsAndFlashcards(
      "company-fit",
      [],
      crawlResult.companyText,
    );
  }

  // Kick off the first pass of question generation, the optional company-fit generation,
  // and the company brief generation in parallel.
  const [firstPass, companyFit, companyBrief] = await Promise.all([
    runGenerationPass(extraction.requirements),
    maybeGenerateCompanyFit(),
    generateCompanyBrief(crawlResult.companyText),
  ]);

  let questions = [...firstPass.questions, ...companyFit.questions];
  let flashcards = [...firstPass.flashcards, ...companyFit.flashcards];
  let passes = 1;
  let coverage = checkCoverage(extraction.requirements, questions);

  // If the first pass didn't cover all requirements, do a second pass to fill in the gaps.
  if (coverage.uncovered_requirement_ids.length > 0) {
    const gapRequirements = extraction.requirements.filter((r) =>
      coverage.uncovered_requirement_ids.includes(r.id),
    );
    const gapFill = await runGenerationPass(gapRequirements);
    questions = [...questions, ...gapFill.questions];
    flashcards = [...flashcards, ...gapFill.flashcards];
    passes = 2;
    coverage = checkCoverage(extraction.requirements, questions);
  }

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
      summary: companyBrief.summary,
      what_they_do: companyBrief.what_they_do,
      sources: crawlResult.pagesUsed,
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
      passes,
    },
  };

  const result = validateKit(candidateKit);
  if (!result.ok) {
    // If the stub itself doesn't pass, something is wrong with the schema
    // wiring, not the LLM output, so we throw an error rather than retrying.
    throw new PipelineError(
      "INTERNAL_SCHEMA_MISMATCH",
      `Generated kit failed validation: ${result.errors.join("; ")}`,
    );
  }

  return result.kit;
}
