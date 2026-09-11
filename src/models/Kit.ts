import mongoose, { Schema, Document, Types } from "mongoose";
import crypto from "crypto";

export type KitStatus = "pending" | "generating" | "ready" | "failed";

export interface KitDocument extends Document {
  ownerId: Types.ObjectId;
  input: {
    jd: string;
    company_url: string;
    days: number;
    inputHash: string;
  };
  status: KitStatus;
  kit: unknown | null; // validated against KitSchema (Appendix A) before ever being saved here
  research: { companyText: string; hiringProcessText: string } | null;
  error: { code: string; message: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const kitSchemaDb = new Schema<KitDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    input: {
      jd: { type: String, required: true },
      company_url: { type: String, required: true },
      days: { type: Number, required: true },
      inputHash: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "generating", "ready", "failed"],
      default: "pending",
      required: true,
    },
    kit: { type: Schema.Types.Mixed, default: null },
    // Sibling to `kit`, outside the Appendix A contract entirely, caches
    // the crawler's raw text so regenerating the company brief or adding
    // more questions later doesn't require re-crawling the site.
    research: {
      type: new Schema(
        { companyText: String, hiringProcessText: String },
        { _id: false },
      ),
      default: null,
    },
    error: {
      type: new Schema({ code: String, message: String }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);

// Defense in depth against the "same description and company submitted twice"
kitSchemaDb.index({ ownerId: 1, "input.inputHash": 1 }, { unique: true });

/**
 * Deterministic hash of the inputs that actually affect generation.
 */
export function computeInputHash(
  jd: string,
  companyUrl: string,
  days: number,
): string {
  const normalized = `${jd.trim()}|${companyUrl.trim().toLowerCase().replace(/\/+$/, "")}|${days}`;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export const KitModel = mongoose.model<KitDocument>("Kit", kitSchemaDb);
