import { Kit, validateKit, Requirement, Question, Flashcard } from "./schema";
import { PipelineError } from "./errors";
import { extractRoleAndRequirements } from "./extractRequirements";
import { crawlCompanySite } from "./crawler";
import { checkCoverage } from "./coverage";
import { allocateSchedule } from "./schedule";
import { planCategories, shouldGenerateCompanyFit } from "./categoryPlanner";
import { generateQuestionsAndFlashcards } from "./generateQuestions";
import { generateCompanyBrief } from "./generateCompanyBrief";
import { searchPublicDiscussion } from "./publicDiscoverySearch";

export interface KitCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export { PipelineError };

export interface GenerateKitResult {
  kit: Kit;
 // The raw text the crawler found on the company site, used to ground
  research: { companyText: string; hiringProcessText: string };
}

// Generates a complete Kit from a job description, company URL, and number of days.
export async function generateKit(
  kitCase: KitCase,
): Promise<GenerateKitResult> {
  if (!kitCase.jd || kitCase.jd.trim().length === 0) {
    throw new PipelineError(
      "EMPTY_JOB_DESCRIPTION",
      "Job description is empty",
    );
  }
  if (!kitCase.days || kitCase.days < 1) {
    throw new PipelineError("INVALID_DAYS", "days must be a positive integer");
  }

  // Independent of each other, JD extraction only needs the pasted text,
  // crawling only needs the company URL, so they run concurrently rather
  // than one waiting on the other. Crawling never throws (see crawler.ts),
  // so only extraction's rejection can end up here.
  const [extraction, crawlResult] = await Promise.all([
    extractRoleAndRequirements(kitCase.jd),
    crawlCompanySite(kitCase.company_url),
  ]);

  // Public discussion search depends on the company NAME, which only
  // exists once the crawl has resolved, so this necessarily runs after
  // the above, not alongside it. Never throws (same discipline as the
  // crawler): a missing key, a failed search, or an unknown company name
  // are all just "no discussion research available," not a failure.
  const publicDiscussion = await searchPublicDiscussion(
    crawlResult.companyName,
  );
  const hiringContext = [crawlResult.hiringProcessText, publicDiscussion.text]
    .filter(Boolean)
    .join("\n\n");
  const allPagesUsed = [...crawlResult.pagesUsed, ...publicDiscussion.sources];

 // Generates questions and flashcards for a set of requirements, returning the structured objects
  async function runGenerationPass(
    requirements: Requirement[],
    seedQuestions: Question[],
    seedFlashcards: Flashcard[],
  ): Promise<{ questions: Question[]; flashcards: Flashcard[] }> {
    const plans = planCategories(requirements, hiringContext);
    const questions: Question[] = [];
    const flashcards: Flashcard[] = [];
    for (const plan of plans) {
      const result = await generateQuestionsAndFlashcards(
        plan.category,
        plan.requirements,
        hiringContext,
        undefined,
        {
          questionIds: [...seedQuestions, ...questions].map((q) => q.id),
          flashcardIds: [...seedFlashcards, ...flashcards].map((f) => f.id),
        },
      );
      questions.push(...result.questions);
      flashcards.push(...result.flashcards);
    }
    return { questions, flashcards };
  }

  async function maybeGenerateCompanyFit(
    seedQuestions: Question[],
    seedFlashcards: Flashcard[],
  ): Promise<{ questions: Question[]; flashcards: Flashcard[] }> {
    if (!shouldGenerateCompanyFit(crawlResult.companyText)) {
      return { questions: [], flashcards: [] }; // nothing to ground it in, skip, don't fabricate
    }
    return generateQuestionsAndFlashcards(
      "company-fit",
      [],
      crawlResult.companyText,
      undefined,
      {
        questionIds: seedQuestions.map((q) => q.id),
        flashcardIds: seedFlashcards.map((f) => f.id),
      },
    );
  }

  // Company brief has zero id dependency, so it still runs fully
  // concurrently. The main category pass and company-fit, however, are
  // NOT run concurrently with each other anymore, company-fit needs to
  // know the main pass's ids to avoid colliding with them, which is only
  // possible once the main pass has actually finished.
  const [combinedFirstPass, companyBrief] = await Promise.all([
    (async () => {
      const mainPass = await runGenerationPass(extraction.requirements, [], []);
      const companyFit = await maybeGenerateCompanyFit(
        mainPass.questions,
        mainPass.flashcards,
      );
      return {
        questions: [...mainPass.questions, ...companyFit.questions],
        flashcards: [...mainPass.flashcards, ...companyFit.flashcards],
      };
    })(),
    generateCompanyBrief(crawlResult.companyText),
  ]);

  let questions = combinedFirstPass.questions;
  let flashcards = combinedFirstPass.flashcards;
  let passes = 1;
  let coverage = checkCoverage(extraction.requirements, questions);

  // The second pass (Section 4): act on gaps once, then stop. Bounded to
  // exactly one extra pass, enough to catch what the first attempt
  // missed, without risking an unbounded retry loop against a
  // rate-limited provider if the model keeps missing the same gap.
  if (coverage.uncovered_requirement_ids.length > 0) {
    const gapRequirements = extraction.requirements.filter((r) =>
      coverage.uncovered_requirement_ids.includes(r.id),
    );
    const gapFill = await runGenerationPass(
      gapRequirements,
      questions,
      flashcards,
    );
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
      pages_used: allPagesUsed,
    },
    company_brief: {
      summary: companyBrief.summary,
      what_they_do: companyBrief.what_they_do,
      sources: allPagesUsed,
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
    // wiring, not with a particular case, this should never happen in
    // normal operation, so it's a genuine internal error.
    throw new PipelineError(
      "INTERNAL_SCHEMA_MISMATCH",
      `Generated kit failed validation: ${result.errors.join("; ")}`,
    );
  }

  return {
    kit: result.kit,
    research: {
      companyText: crawlResult.companyText,
      // Cached as the already-combined context (crawled hiring page text +
      // public discussion results), so a later regeneration reuses this
      // without needing a fresh Firecrawl search.
      hiringProcessText: hiringContext,
    },
  };
}
