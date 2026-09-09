import { z } from "zod";


const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
});

const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
});

const ScheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string().min(1)),
  minutes: z.number().int().min(0),
});

export const KitSchema = z
  .object({
    source: z.object({
      company: z.string(),
      company_url: z.string(),
      role: z.string(),
      location: z.string(),
      jd_chars: z.number().int().min(0),
      researched_at: z.string(),
      pages_used: z.array(z.string()),
    }),
    company_brief: z.object({
      summary: z.string(),
      what_they_do: z.string(),
      sources: z.array(z.string()),
    }),
    role: z.object({
      title: z.string(),
      seniority: z.string(),
      responsibilities: z.array(z.string()),
      requirements: z.array(RequirementSchema),
    }),
    questions: z.array(QuestionSchema),
    flashcards: z.array(FlashcardSchema),
    schedule: z.object({
      days_available: z.number().int().min(1),
      days: z.array(ScheduleDaySchema),
    }),
    coverage: z.object({
      uncovered_requirement_ids: z.array(z.string()),
      passes: z.number().int().min(0),
    }),
  })
  // Cross-field rules the brief calls out explicitly.
  .superRefine((kit, ctx) => {
    const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
    const questionIds = new Set(kit.questions.map((q) => q.id));

    kit.questions.forEach((q, i) => {
      q.requirement_ids.forEach((rid) => {
        if (!requirementIds.has(rid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `questions[${i}] references unknown requirement id "${rid}"`,
            path: ["questions", i, "requirement_ids"],
          });
        }
      });
    });

    kit.schedule.days.forEach((day, i) => {
      day.question_ids.forEach((qid) => {
        if (!questionIds.has(qid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `schedule.days[${i}] references unknown question id "${qid}"`,
            path: ["schedule", "days", i, "question_ids"],
          });
        }
      });
    });

    if (kit.schedule.days.length !== kit.schedule.days_available) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `schedule has ${kit.schedule.days.length} days but days_available is ${kit.schedule.days_available}`,
        path: ["schedule", "days"],
      });
    }
  });

export type Kit = z.infer<typeof KitSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

/**
 * Validates a candidate kit object.
 */
export function validateKit(
  candidate: unknown,
): { ok: true; kit: Kit } | { ok: false; errors: string[] } {
  const result = KitSchema.safeParse(candidate);
  if (result.success) {
    return { ok: true, kit: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}
