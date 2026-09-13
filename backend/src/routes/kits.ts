import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "./requireAuth";
import { KitModel, computeInputHash } from "../models/Kit";
import { CreateKitSchema } from "../lib/kitValidation";
import { generateKit, PipelineError } from "../lib/pipeline";

import { asyncHandler } from "./asyncHandler";

const router = Router();
router.use(requireAuth); // every route below requires a signed-in user

/**
 * Runs the pipeline in the background and updates the document as it
 * progresses.
 */
async function runGeneration(kitDocId: string) {
  try {
    await KitModel.findByIdAndUpdate(kitDocId, { status: "generating" });

    const doc = await KitModel.findById(kitDocId);
    if (!doc) return; // deleted mid-flight — nothing to update

    const { kit, research } = await generateKit({
      id: kitDocId,
      jd: doc.input.jd,
      company_url: doc.input.company_url,
      days: doc.input.days,
    });

    await KitModel.findByIdAndUpdate(kitDocId, {
      status: "ready",
      kit,
      research,
      error: null,
    });
  } catch (err) {
    const pipelineErr =
      err instanceof PipelineError
        ? err
        : new PipelineError("UNKNOWN_ERROR", (err as Error).message);
    await KitModel.findByIdAndUpdate(kitDocId, {
      status: "failed",
      error: { code: pipelineErr.code, message: pipelineErr.message },
    });
  }
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = CreateKitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues.map((i) => i.message).join("; "),
        },
      });
    }
    const { jd, company_url, days } = parsed.data;
    const ownerId = req.session.userId!;
    const inputHash = computeInputHash(jd, company_url, days);

    // Dedupe check: the same JD + company + days submitted twice by the
    // same user reuses the existing kit rather than burning another LLM run.
    const existing = await KitModel.findOne({
      ownerId,
      "input.inputHash": inputHash,
    });
    if (existing) {
      return res.status(200).json(serializeKit(existing));
    }

    try {
      const created = await KitModel.create({
        ownerId,
        input: { jd, company_url, days, inputHash },
        status: "pending",
      });

      runGeneration(String(created._id)); // fire-and-forget

      res.status(202).json(serializeKit(created));
    } catch (err: any) {
      if (err?.code === 11000) {
        // Two identical requests raced each other — the unique index caught
        // it. Fetch and return the one that won instead of erroring.
        const winner = await KitModel.findOne({
          ownerId,
          "input.inputHash": inputHash,
        });
        if (winner) return res.status(200).json(serializeKit(winner));
      }
      throw err;
    }
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownerId = req.session.userId!;
    const kits = await KitModel.find({ ownerId })
      .sort({ createdAt: -1 })
      .select("-kit");
    res.json(kits.map(serializeKit));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    }
    const ownerId = req.session.userId!;
    const kit = await KitModel.findOne({ _id: req.params.id, ownerId });
    if (!kit) {
      // Same response whether it doesn't exist or belongs to someone else —
      // don't leak which case it is.
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    }
    res.json(serializeKit(kit));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    }
    const ownerId = req.session.userId!;
    const result = await KitModel.deleteOne({ _id: req.params.id, ownerId });
    if (result.deletedCount === 0) {
      // Same response whether it doesn't exist or belongs to someone else.
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    }
    res.status(204).send();
  }),
);

function serializeKit(doc: InstanceType<typeof KitModel>) {
  return {
    id: doc._id,
    status: doc.status,
    input: { company_url: doc.input.company_url, days: doc.input.days },
    kit: doc.kit ?? null,
    error: doc.error ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export default router;
