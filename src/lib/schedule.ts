import { Requirement, Question, ScheduleDay } from "./schema";

/**
 * Deterministic, integer minutes-per-question estimate keyed by difficulty.
 */
const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = {
  1: 15,
  2: 25,
  3: 40,
};

/**
 * Splits `total` items into `days` buckets as evenly as possible, with any
 * remainder going to the EARLIER buckets.
 */
function bucketSizes(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total % days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

function priorityRank(question: Question, requirementPriority: Map<string, "must" | "nice">): number {
  // A question can reference multiple requirements with mixed priority.
  // If ANY linked requirement is a must-have, the question is treated as
  // must-have for ordering purposes.
  const isMust = question.requirement_ids.some((rid) => requirementPriority.get(rid) === "must");
  return isMust ? 0 : 1;
}

function focusForDay(dayQuestions: Question[]): string {
  if (dayQuestions.length === 0) {
    return "No material scheduled for this day, insufficient content generated";
  }
  const categories = Array.from(new Set(dayQuestions.map((q) => q.category)));
  return categories.join(", ");
}

/**
 * Allocates all given questions across exactly `days` days.
 */
export function allocateSchedule(
  questions: Question[],
  requirements: Requirement[],
  days: number
): { days_available: number; days: ScheduleDay[] } {
  if (days < 1) {
    throw new Error("allocateSchedule requires at least 1 day");
  }

  const requirementPriority = new Map(requirements.map((r) => [r.id, r.priority]));

  const sorted = [...questions].sort((a, b) => {
    const rankDiff = priorityRank(a, requirementPriority) - priorityRank(b, requirementPriority);
    if (rankDiff !== 0) return rankDiff;
    return b.difficulty - a.difficulty; // harder first within same priority
  });

  const sizes = bucketSizes(sorted.length, days);

  const result: ScheduleDay[] = [];
  let cursor = 0;
  for (let i = 0; i < days; i++) {
    const dayQuestions = sorted.slice(cursor, cursor + sizes[i]);
    cursor += sizes[i];

    const minutes = dayQuestions.reduce(
      (sum, q) => sum + MINUTES_BY_DIFFICULTY[q.difficulty as 1 | 2 | 3],
      0
    );

    result.push({
      day: i + 1,
      focus: focusForDay(dayQuestions),
      question_ids: dayQuestions.map((q) => q.id),
      minutes,
    });
  }

  return { days_available: days, days: result };
}
