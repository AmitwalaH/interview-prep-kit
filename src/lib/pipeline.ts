import { Kit, validateKit } from "./schema";

export interface KitCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export class PipelineError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

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

  const stubKit = {
    source: {
      company: "",
      company_url: kitCase.company_url,
      role: "",
      location: "",
      jd_chars: kitCase.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: {
      summary: "",
      what_they_do: "",
      sources: [],
    },
    role: {
      title: "",
      seniority: "",
      responsibilities: [],
      requirements: [],
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: kitCase.days,
      //Each day is empty, no questions yet to assign.
      days: Array.from({ length: kitCase.days }, (_, i) => ({
        day: i + 1,
        focus: "",
        question_ids: [],
        minutes: 0,
      })),
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
  };

  const result = validateKit(stubKit);
  if (!result.ok) {
    // If the stub itself doesn't pass, something is wrong with the schema or the stub generation logic,
    // not the input. This is an internal error.
    throw new PipelineError(
      "INTERNAL_SCHEMA_MISMATCH",
      `Generated kit failed validation: ${result.errors.join("; ")}`,
    );
  }

  return result.kit;
}
