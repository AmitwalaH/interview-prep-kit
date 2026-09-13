import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { requireAuth } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";
import { KitModel } from "../models/Kit";
import {
  EditQuestionSchema,
  AddQuestionSchema,
  EditFlashcardSchema,
  AddFlashcardSchema,
  ReorderQuestionsSchema,
  RegenerateSectionSchema,
  RecordPracticeSchema,
} from "../lib/builderValidation";
import { Kit, validateKit } from "../lib/schema";
import { generateQuestionsAndFlashcards } from "../lib/generateQuestions";
import { generateCompanyBrief } from "../lib/generateCompanyBrief";
import { allocateSchedule } from "../lib/schedule";
import {
  mergeCategoryRegeneration,
  pruneScheduleReferences,
} from "../lib/regenerateMerge";
import {
  orderForPracticeSession,
  practiceCoverage,
} from "../lib/practiceOrdering";
import { PipelineError } from "../lib/errors";

const router = Router();
router.use(requireAuth);

/**
 * Loads a kit owned by the current user, in "ready" status with a
 * non-null kit body. Every builder route needs exactly this check, so
 * it's centralized rather than repeated six times with slightly
 * different bugs each time.
 */
async function loadEditableKit(kitId: string, ownerId: string) {
  if (!mongoose.Types.ObjectId.isValid(kitId)) return { error: 404 as const };
  const doc = await KitModel.findOne({ _id: kitId, ownerId });
  if (!doc) return { error: 404 as const };
  if (doc.status !== "ready" || !doc.kit) return { error: 409 as const };
  return { doc };
}

function sendLoadError(res: any, error: 404 | 409) {
  if (error === 404) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
  }
  return res.status(409).json({
    error: {
      code: "KIT_NOT_READY",
      message: "Kit is not in a ready state to edit",
    },
  });
}

/** Persists an edited kit body, re-validating it against Appendix A first. */
async function saveKit(doc: any, updatedKit: Kit) {
  const result = validateKit(updatedKit);
  if (!result.ok) {
    throw new PipelineError(
      "INTERNAL_SCHEMA_MISMATCH",
      result.errors.join("; "),
    );
  }
  doc.kit = result.kit;
  doc.markModified("kit"); // Mixed-type fields need this — Mongoose can't see into a plain object mutation
  await doc.save();
  return result.kit;
}

function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

// ---------- Questions ----------

// IMPORTANT: this literal-path route MUST be registered before
// PATCH /:id/questions/:qid below. Express matches routes in registration
// order, and ":qid" would otherwise greedily match the literal segment
// "reorder" (as if it were a question id), shadowing this route entirely
// and returning a false "Question not found" 404 for every reorder call.
router.patch(
  "/:id/questions/reorder",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = ReorderQuestionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: {
            code: "INVALID_INPUT",
            message: "order must be a list of ids",
          },
        });
    }

    const kit = doc!.kit as Kit;
    const currentIds = new Set(kit.questions.map((q) => q.id));
    const requestedIds = new Set(parsed.data.order);
    const isSamePermutation =
      currentIds.size === requestedIds.size &&
      [...currentIds].every((id) => requestedIds.has(id));
    if (!isSamePermutation) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "order must contain exactly the kit's existing question ids",
        },
      });
    }

    const byId = new Map(kit.questions.map((q) => [q.id, q]));
    kit.questions = parsed.data.order.map((id) => byId.get(id)!);

    const saved = await saveKit(doc, kit);
    res.json(saved.questions);
  }),
);

router.patch(
  "/:id/questions/:qid",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = EditQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { code: "INVALID_INPUT", message: "Invalid question edit" },
        });
    }

    const kit = doc!.kit as Kit;
    const question = kit.questions.find((q) => q.id === req.params.qid);
    if (!question) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Question not found" } });
    }

    Object.assign(question, parsed.data);
    // Pinned is a stronger, explicit signal than a plain edit — an edit to
    // an already-pinned question shouldn't demote it back to "edited".
    if (question.status !== "pinned") question.status = "edited";

    const saved = await saveKit(doc, kit);
    res.json(saved.questions.find((q) => q.id === req.params.qid));
  }),
);

router.post(
  "/:id/questions",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = AddQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { code: "INVALID_INPUT", message: "Invalid question" },
        });
    }

    const kit = doc!.kit as Kit;
    const validReqIds = new Set(kit.role.requirements.map((r) => r.id));
    const newQuestion = {
      id: shortId("q"),
      requirement_ids: parsed.data.requirement_ids.filter((id) =>
        validReqIds.has(id),
      ),
      category: parsed.data.category,
      prompt: parsed.data.prompt,
      answer_outline: parsed.data.answer_outline,
      difficulty: parsed.data.difficulty,
      status: "edited" as const, // hand-authored — must survive regeneration like any edit
    };
    kit.questions.push(newQuestion);

    const saved = await saveKit(doc, kit);
    res.status(201).json(saved.questions.find((q) => q.id === newQuestion.id));
  }),
);

router.delete(
  "/:id/questions/:qid",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const kit = doc!.kit as Kit;
    const existed = kit.questions.some((q) => q.id === req.params.qid);
    if (!existed) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Question not found" } });
    }

    kit.questions = kit.questions.filter((q) => q.id !== req.params.qid);
    // Keep the schedule's cross-references valid — a day that pointed at
    // the deleted question can't be left dangling.
    kit.schedule.days = pruneScheduleReferences(
      kit.schedule.days,
      kit.questions,
    );

    await saveKit(doc, kit);
    res.status(204).send();
  }),
);

// ---------- Flashcards ----------

router.patch(
  "/:id/flashcards/:fid",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = EditFlashcardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { code: "INVALID_INPUT", message: "Invalid flashcard edit" },
        });
    }

    const kit = doc!.kit as Kit;
    const card = kit.flashcards.find((f) => f.id === req.params.fid);
    if (!card) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Flashcard not found" } });
    }

    Object.assign(card, parsed.data);
    if (card.status !== "pinned") card.status = "edited";

    const saved = await saveKit(doc, kit);
    res.json(saved.flashcards.find((f) => f.id === req.params.fid));
  }),
);

router.post(
  "/:id/flashcards",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = AddFlashcardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: { code: "INVALID_INPUT", message: "Invalid flashcard" },
        });
    }

    const kit = doc!.kit as Kit;
    const validReqIds = new Set(kit.role.requirements.map((r) => r.id));
    const newCard = {
      id: shortId("f"),
      front: parsed.data.front,
      back: parsed.data.back,
      requirement_ids: parsed.data.requirement_ids.filter((id) =>
        validReqIds.has(id),
      ),
      status: "edited" as const,
      source_question_id: null,
      practice: {
        confidence: null,
        times_practiced: 0,
        last_practiced_at: null,
      },
    };
    kit.flashcards.push(newCard);

    const saved = await saveKit(doc, kit);
    res.status(201).json(saved.flashcards.find((f) => f.id === newCard.id));
  }),
);

router.delete(
  "/:id/flashcards/:fid",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const kit = doc!.kit as Kit;
    const existed = kit.flashcards.some((f) => f.id === req.params.fid);
    if (!existed) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Flashcard not found" } });
    }

    kit.flashcards = kit.flashcards.filter((f) => f.id !== req.params.fid);
    await saveKit(doc, kit);
    res.status(204).send();
  }),
);

// ---------- Regenerate one section ----------

router.post(
  "/:id/regenerate",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = RegenerateSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: { code: "INVALID_INPUT", message: "Invalid section" } });
    }
    const { section } = parsed.data;

    if (!doc!.research) {
      return res.status(409).json({
        error: {
          code: "NO_RESEARCH_CACHED",
          message:
            "This kit was generated before research caching existed and cannot be regenerated in place",
        },
      });
    }

    const kit = doc!.kit as Kit;

    if (section === "company_brief") {
      const brief = await generateCompanyBrief(doc!.research.companyText);
      kit.company_brief.summary = brief.summary;
      kit.company_brief.what_they_do = brief.what_they_do;
      const saved = await saveKit(doc, kit);
      return res.json(saved.company_brief);
    }

    if (section === "schedule") {
      kit.schedule = allocateSchedule(
        kit.questions,
        kit.role.requirements,
        kit.schedule.days_available,
      );
      const saved = await saveKit(doc, kit);
      return res.json(saved.schedule);
    }

    // Otherwise it's a question category. system-design targets the same
    // technical requirements as "technical" — matches how planCategories
    // decided this originally during generation.
    const targetRequirements =
      section === "company-fit"
        ? []
        : kit.role.requirements.filter((r) =>
            section === "behavioural"
              ? r.kind === "behavioural"
              : r.kind === "technical" || r.kind === "domain",
          );

    const companyContext =
      section === "company-fit"
        ? doc!.research.companyText
        : doc!.research.hiringProcessText;

    // Seed id generation from THIS kit's actual current ids — critical
    // now that ids are no longer a global counter. Without this, a fresh
    // regeneration could produce ids colliding with ones already sitting
    // in this kit (including ones surviving the merge below).
    const fresh = await generateQuestionsAndFlashcards(
      section,
      targetRequirements,
      companyContext,
      undefined,
      {
        questionIds: kit.questions.map((q) => q.id),
        flashcardIds: kit.flashcards.map((f) => f.id),
      },
    );

    const merged = mergeCategoryRegeneration(
      kit.questions,
      kit.flashcards,
      section,
      fresh.questions,
      fresh.flashcards,
    );
    kit.questions = merged.questions;
    kit.flashcards = merged.flashcards;
    kit.schedule.days = pruneScheduleReferences(
      kit.schedule.days,
      kit.questions,
    );

    const saved = await saveKit(doc, kit);
    res.json({ questions: saved.questions, flashcards: saved.flashcards });
  }),
);

// ---------- Practice mode ----------

router.post(
  "/:id/flashcards/:fid/practice",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const parsed = RecordPracticeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "confidence must be an integer from 1 to 5",
        },
      });
    }

    const kit = doc!.kit as Kit;
    const card = kit.flashcards.find((f) => f.id === req.params.fid);
    if (!card) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Flashcard not found" } });
    }

    card.practice.confidence = parsed.data.confidence;
    card.practice.times_practiced += 1;
    card.practice.last_practiced_at = new Date().toISOString();

    const saved = await saveKit(doc, kit);
    res.json(saved.flashcards.find((f) => f.id === req.params.fid));
  }),
);

router.get(
  "/:id/practice/next",
  asyncHandler(async (req, res) => {
    const { doc, error } = await loadEditableKit(
      req.params.id,
      req.session.userId!,
    );
    if (error) return sendLoadError(res, error);

    const kit = doc!.kit as Kit;
    res.json({
      coverage: practiceCoverage(kit.flashcards),
      order: orderForPracticeSession(kit.flashcards),
    });
  }),
);

export default router;
