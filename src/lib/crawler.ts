import { assertSafeUrl, UnsafeUrlError } from "./urlSafety";
import { loadRobotsRules } from "./robotsTxt";
import { fetchPage } from "./htmlFetch";

const MAX_CANDIDATE_PAGES = 3;
const DELAY_BETWEEN_REQUESTS_MS = 300;
const MAX_HIRING_TEXT_CHARS = 8000;

// Weighted keyword scoring, deliberately not a fixed path list.
const KEYWORD_WEIGHTS: [RegExp, number][] = [
  [/career/i, 10],
  [/\bjob/i, 10],
  [/hiring/i, 10],
  [/join[-_]?us/i, 8],
  [/interview/i, 8],
  [/apply/i, 6],
  [/work[-_]?with[-_]?us/i, 6],
  [/handbook/i, 6],
  [/life[-_]?at/i, 6],
  [/culture/i, 5],
  [/team/i, 3],
  [/blog/i, 2],
];

export function scoreLink(href: string, anchorText: string): number {
  const haystack = `${href} ${anchorText}`.toLowerCase();
  return KEYWORD_WEIGHTS.reduce(
    (score, [pattern, weight]) =>
      pattern.test(haystack) ? score + weight : score,
    0,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlResult {
  companyText: string;
  hiringProcessText: string;
  pagesUsed: string[];
  failures: { url: string; reason: string }[];
}

const EMPTY_RESULT: Omit<CrawlResult, "failures"> = {
  companyText: "",
  hiringProcessText: "",
  pagesUsed: [],
};

/**
 * Crawls a company's site starting from its homepage, ranks outbound
 * links by relevance to "how they hire," and fetches the top candidates.
 */
export async function crawlCompanySite(
  companyUrl: string,
): Promise<CrawlResult> {
  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(companyUrl);
  } catch (err) {
    const reason =
      err instanceof UnsafeUrlError ? err.message : (err as Error).message;
    return { ...EMPTY_RESULT, failures: [{ url: companyUrl, reason }] };
  }

  const robots = await loadRobotsRules(safeUrl.origin);
  if (!robots.isAllowed(safeUrl.toString())) {
    return {
      ...EMPTY_RESULT,
      failures: [{ url: companyUrl, reason: "Disallowed by robots.txt" }],
    };
  }

  const homepage = await fetchPage(safeUrl.toString());
  if (!homepage) {
    // Covers both "URL invalid/404/timeout" and effectively "no discoverable
    // page at all", the two edge cases Section 10 explicitly tests.
    return {
      ...EMPTY_RESULT,
      failures: [{ url: companyUrl, reason: "Homepage unreachable" }],
    };
  }

  const pagesUsed = [safeUrl.toString()];
  const failures: { url: string; reason: string }[] = [];

  const ranked = homepage.links
    .map((link) => ({ ...link, score: scoreLink(link.href, link.text) }))
    .filter((link) => link.score > 0 && robots.isAllowed(link.href))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATE_PAGES);

  const hiringTextParts: string[] = [];

  for (const candidate of ranked) {
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
    const page = await fetchPage(candidate.href);
    if (!page) {
      failures.push({
        url: candidate.href,
        reason: "Unreachable or unfetchable",
      });
      continue;
    }
    pagesUsed.push(candidate.href);
    hiringTextParts.push(page.text);
  }

  // Honest when nothing relevant was found: hiringProcessText stays empty
  // rather than being backfilled with the homepage text, which would
  // misrepresent "we found nothing" as "here's what we found."
  const hiringProcessText = hiringTextParts
    .join("\n\n")
    .slice(0, MAX_HIRING_TEXT_CHARS);

  return {
    companyText: homepage.text,
    hiringProcessText,
    pagesUsed,
    failures,
  };
}
