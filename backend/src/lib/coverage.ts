import { Requirement, Question } from "./schema";

export interface CoverageResult {
  uncovered_requirement_ids: string[];
}

/**
 * Compares generated questions against extracted requirements to find gaps.
 */
export function checkCoverage(requirements: Requirement[], questions: Question[]): CoverageResult {
  const coveredIds = new Set<string>();
  for (const question of questions) {
    for (const rid of question.requirement_ids) {
      coveredIds.add(rid);
    }
  }

  const uncovered = requirements
    .filter((req) => !coveredIds.has(req.id))
    .map((req) => req.id);

  return { uncovered_requirement_ids: uncovered };
}

export function uncoveredMustHaves(requirements: Requirement[], questions: Question[]): string[] {
  const { uncovered_requirement_ids } = checkCoverage(requirements, questions);
  const mustIds = new Set(requirements.filter((r) => r.priority === "must").map((r) => r.id));
  return uncovered_requirement_ids.filter((id) => mustIds.has(id));
}
