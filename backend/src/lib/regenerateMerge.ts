import { Question, Flashcard, ScheduleDay } from "./schema";
import { QuestionCategory } from "./categoryPlanner";
import { MINUTES_BY_DIFFICULTY } from "./schedule";

export interface CategoryMergeResult {
  questions: Question[];
  flashcards: Flashcard[];
}

// Merges questions and flashcards for a specific category, handling regeneration logic

export function mergeCategoryRegeneration(
  existingQuestions: Question[],
  existingFlashcards: Flashcard[],
  category: QuestionCategory,
  freshQuestions: Question[],
  freshFlashcards: Flashcard[],
): CategoryMergeResult {
  const survivingCategoryQuestions = existingQuestions.filter(
    (q) => q.category === category && q.status !== "generated",
  );
  const discardedIds = new Set(
    existingQuestions
      .filter((q) => q.category === category && q.status === "generated")
      .map((q) => q.id),
  );
  const otherCategoryQuestions = existingQuestions.filter(
    (q) => q.category !== category,
  );

  const questions = [
    ...otherCategoryQuestions,
    ...survivingCategoryQuestions,
    ...freshQuestions,
  ];

  const survivingFlashcards = existingFlashcards.filter(
    (f) =>
      f.source_question_id === null || !discardedIds.has(f.source_question_id),
  );
  const flashcards = [...survivingFlashcards, ...freshFlashcards];

  return { questions, flashcards };
}

// Removes references to questions that are no longer present in the schedule,
// and recalculates the total minutes for each day based on the remaining questions.
export function pruneScheduleReferences(
  days: ScheduleDay[],
  validQuestions: Question[],
): ScheduleDay[] {
  const questionById = new Map(validQuestions.map((q) => [q.id, q]));

  return days.map((day) => {
    const survivingIds = day.question_ids.filter((id) => questionById.has(id));
    const minutes = survivingIds.reduce((sum, id) => {
      const q = questionById.get(id)!;
      return sum + MINUTES_BY_DIFFICULTY[q.difficulty as 1 | 2 | 3];
    }, 0);
    return { ...day, question_ids: survivingIds, minutes };
  });
}
