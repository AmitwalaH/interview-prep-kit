export interface KitFormInput {
  jd: string;
  company_url: string;
  days: number;
}

export function validateKitInput(input: Partial<KitFormInput>): string | null {
  if (!input.jd || input.jd.trim().length === 0) return "Job description is required";
  if (!input.company_url || input.company_url.trim().length === 0) return "Company URL is required";
  try {
    new URL(input.company_url);
  } catch {
    return "Company URL must be a valid URL (include https://)";
  }
  if (!input.days || !Number.isInteger(input.days) || input.days < 1 || input.days > 365) {
    return "Days must be a whole number between 1 and 365";
  }
  return null;
}

/**
 * Parses a batch upload file for the "prepare for more than one role"
 * flow (Section 2). Accepts JSON (array of {jd, company_url, days}) since
 * that's unambiguous and matches the backend's own case shape — CSV would
 * need escaping rules for multi-line job descriptions, which is exactly
 * the kind of fragile parsing not worth the time under this timebox.
 */
export function parseBatchFile(text: string): { valid: KitFormInput[]; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: [], errors: ["File is not valid JSON"] };
  }
  if (!Array.isArray(parsed)) {
    return { valid: [], errors: ["File must contain a JSON array of {jd, company_url, days} objects"] };
  }

  const valid: KitFormInput[] = [];
  parsed.forEach((item, i) => {
    const error = validateKitInput(item);
    if (error) {
      errors.push(`Entry ${i + 1}: ${error}`);
    } else {
      valid.push({ jd: item.jd, company_url: item.company_url, days: item.days });
    }
  });

  return { valid, errors };
}
