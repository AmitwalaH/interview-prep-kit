export interface User {
  id: string;
  email: string;
}

export type KitStatus = "pending" | "generating" | "ready" | "failed";

export interface KitError {
  code: string;
  message: string;
}

export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
}

export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type ItemStatus = "generated" | "edited" | "pinned";

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  status: ItemStatus;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  status: ItemStatus;
  source_question_id: string | null;
  practice: {
    confidence: number | null;
    times_practiced: number;
    last_practiced_at: string | null;
  };
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Kit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
}

/** Shape returned by both GET /api/kits (list, kit body stripped) and GET /api/kits/:id (single, full body). */
export interface KitDocument {
  id: string;
  status: KitStatus;
  input: { company_url: string; days: number };
  kit: Kit | null;
  error: KitError | null;
  createdAt: string;
  updatedAt: string;
}
