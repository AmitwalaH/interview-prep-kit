import { z } from "zod";

export const EditQuestionSchema = z.object({
  prompt: z.string().min(1).optional(),
  answer_outline: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  category: z
    .enum(["technical", "behavioural", "system-design", "company-fit"])
    .optional(),
  // Lets the client explicitly pin/unpin without going through a content
  // edit. Any other field present still promotes status to "edited",
  // handled in the route, not here.
  status: z.enum(["edited", "pinned"]).optional(),
});

export const AddQuestionSchema = z.object({
  requirement_ids: z.array(z.string()).default([]),
  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),
  prompt: z.string().min(1),
  answer_outline: z.string().default(""),
  difficulty: z.number().int().min(1).max(3),
});

export const EditFlashcardSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  status: z.enum(["edited", "pinned"]).optional(),
});

export const AddFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).default([]),
});

export const ReorderQuestionsSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const RegenerateSectionSchema = z.object({
  section: z.enum([
    "company_brief",
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
    "schedule",
  ]),
});

export const RecordPracticeSchema = z.object({
  confidence: z.number().int().min(1).max(5),
});
