import { Requirement, Question, ScheduleDay } from "./schema";

// Minutes of study time per question, by difficulty level. The brief
// says the schedule should be "harder and higher-priority material lands
// earlier, not the night before," so this is used to compute the total
// minutes of study time per day.
export const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = {
  1: 15,
  2: 25,
  3: 40,
};

// Returns an array of integers representing how many questions should be
// allocated to each day, given a total number of questions and a total
// number of days. The distribution is as even as possible, with any
// remainder distributed to the earliest days.
function bucketSizes(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total % days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

function priorityRank(
  question: Question,
  requirementPriority: Map<string, "must" | "nice">,
): number {
  // A question can reference multiple requirements with mixed priority.
  // If ANY linked requirement is a must-have, the question is treated as
  // must-have for ordering purposes — we'd rather over-prioritize than
  // bury a must-have question behind "nice to have" material.
  const isMust = question.requirement_ids.some(
    (rid) => requirementPriority.get(rid) === "must",
  );
  return isMust ? 0 : 1;
}

export function focusForDay(dayQuestions: Question[]): string {
  if (dayQuestions.length === 0) {
    // Honest, not fabricated: this happens when the user requests more
    // days than there is material to fill (e.g. a 60-day schedule against
    // a thin job description). Reporting it plainly beats inventing filler.
    return "No material scheduled for this day — insufficient content generated";
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
  days: number,
): { days_available: number; days: ScheduleDay[] } {
  if (days < 1) {
    throw new Error("allocateSchedule requires at least 1 day");
  }

  const requirementPriority = new Map(
    requirements.map((r) => [r.id, r.priority]),
  );

  const sorted = [...questions].sort((a, b) => {
    const rankDiff =
      priorityRank(a, requirementPriority) -
      priorityRank(b, requirementPriority);
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
      0,
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
