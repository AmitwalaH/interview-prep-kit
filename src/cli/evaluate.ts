import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { generateKit, KitCase, PipelineError } from "../lib/pipeline";

interface CliArgs {
  input: string;
  output: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    if (argv[i] === "--output") args.output = argv[++i];
  }
  if (!args.input || !args.output) {
    throw new Error(
      "Usage: npm run evaluate -- --input <cases.json> --output <kits.json>",
    );
  }
  return args as CliArgs;
}

interface KitResultEntry {
  id: string;
  status: "ok" | "failed";
  kit: unknown | null;
  error: { code: string; message: string } | null;
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));

  const raw = readFileSync(input, "utf-8");
  const cases: KitCase[] = JSON.parse(raw);

  const results: KitResultEntry[] = [];

  // Sequential for now, deliberate choice while the pipeline is a stub.
  for (const kitCase of cases) {
    try {
      const kit = await generateKit(kitCase);
      results.push({ id: kitCase.id, status: "ok", kit, error: null });
    } catch (err) {
      const pipelineErr =
        err instanceof PipelineError
          ? err
          : new PipelineError("UNKNOWN_ERROR", (err as Error).message);
      results.push({
        id: kitCase.id,
        status: "failed",
        kit: null,
        error: { code: pipelineErr.code, message: pipelineErr.message },
      });
    }
  }

  const outputPayload = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  writeFileSync(output, JSON.stringify(outputPayload, null, 2));

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(
    `Wrote ${results.length} kit(s) to ${output} (${okCount} ok, ${results.length - okCount} failed)`,
  );
}

main().catch((err) => {
  console.error("Fatal error running batch evaluation:", err.message);
  process.exit(1);
});
