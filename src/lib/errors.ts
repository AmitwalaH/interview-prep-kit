/**
 * A typed error the pipeline raises for cases it genuinely cannot produce
 * a kit for at all (per the brief: "failed" is reserved for total failure,
 * not partial research).
 */
export class PipelineError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "PipelineError";
  }
}
