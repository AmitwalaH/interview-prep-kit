import { z } from "zod";

export const CreateKitSchema = z.object({
  jd: z.string().trim().min(1, "Job description cannot be empty"),
  company_url: z.string().trim().url("company_url must be a valid URL"),
  // days must be a positive integer between 1 and 365
  days: z.number().int().min(1).max(365),
});

export type CreateKitInput = z.infer<typeof CreateKitSchema>;
