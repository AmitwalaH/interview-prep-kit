import { apiFetch } from "./apiClient";
import { KitDocument, Question, Flashcard, QuestionCategory } from "./types";

export function getKit(id: string) {
  return apiFetch<KitDocument>(`/api/kits/${id}`);
}

export function deleteKit(id: string) {
  return apiFetch<void>(`/api/kits/${id}`, { method: "DELETE" });
}

export function editQuestion(
  kitId: string,
  questionId: string,
  patch: Partial<Question>,
) {
  return apiFetch<Question>(`/api/kits/${kitId}/questions/${questionId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function addQuestion(
  kitId: string,
  input: {
    category: QuestionCategory;
    prompt: string;
    answer_outline: string;
    difficulty: 1 | 2 | 3;
    requirement_ids?: string[];
  },
) {
  return apiFetch<Question>(`/api/kits/${kitId}/questions`, {
    method: "POST",
    body: input,
  });
}

export function deleteQuestion(kitId: string, questionId: string) {
  return apiFetch<void>(`/api/kits/${kitId}/questions/${questionId}`, {
    method: "DELETE",
  });
}

export function reorderQuestions(kitId: string, order: string[]) {
  return apiFetch<Question[]>(`/api/kits/${kitId}/questions/reorder`, {
    method: "PATCH",
    body: { order },
  });
}

export function editFlashcard(
  kitId: string,
  flashcardId: string,
  patch: Partial<Flashcard>,
) {
  return apiFetch<Flashcard>(`/api/kits/${kitId}/flashcards/${flashcardId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function addFlashcard(
  kitId: string,
  input: { front: string; back: string; requirement_ids?: string[] },
) {
  return apiFetch<Flashcard>(`/api/kits/${kitId}/flashcards`, {
    method: "POST",
    body: input,
  });
}

export function deleteFlashcard(kitId: string, flashcardId: string) {
  return apiFetch<void>(`/api/kits/${kitId}/flashcards/${flashcardId}`, {
    method: "DELETE",
  });
}

export function recordPractice(
  kitId: string,
  flashcardId: string,
  confidence: number,
) {
  return apiFetch<Flashcard>(
    `/api/kits/${kitId}/flashcards/${flashcardId}/practice`,
    {
      method: "POST",
      body: { confidence },
    },
  );
}

export function getPracticeSession(kitId: string) {
  return apiFetch<{
    coverage: { practiced: number; total: number };
    order: Flashcard[];
  }>(`/api/kits/${kitId}/practice/next`);
}

export type RegenerateSection =
  | "company_brief"
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit"
  | "schedule";

export function regenerateSection(kitId: string, section: RegenerateSection) {
  return apiFetch(`/api/kits/${kitId}/regenerate`, {
    method: "POST",
    body: { section },
  });
}
