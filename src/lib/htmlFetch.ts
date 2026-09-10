import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB, a hiring page is not a video file
const MAX_CLEANED_TEXT_CHARS = 6000; // keeps downstream LLM prompts bounded
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain"];

export interface FetchedPage {
  url: string;
  text: string;
  links: { href: string; text: string }[];
}

/**
 * Fetches one page and returns null (never throws) if it can't be
 * retrieved or isn't safe/useful to process.
 */
export async function fetchPage(url: string): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "InterviewPrepKitBot/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))) {
      return null; // e.g. images, PDFs, binaries.
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return null;
    }

    const html = await response.text();
    if (html.length > MAX_BODY_BYTES) {
      return null; // backstop for servers that don't send Content-Length
    }

    return extractCleanTextAndLinks(html, url);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Strips script/style/nav/footer noise, collapses whitespace, and caps
 * length.
 * ("/careers", not "https://company.com/careers").
 */
function extractCleanTextAndLinks(html: string, baseUrl: string): FetchedPage {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);

  // Extracting links first, before stripping noise,
  // so we don't miss any links that are in nav/footer/script.
  const links: { href: string; text: string }[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const hrefAttr = $(el).attr("href");
    if (!hrefAttr) return;
    let resolved: string;
    try {
      resolved = new URL(hrefAttr, base).toString();
    } catch {
      return; // malformed href (e.g. "javascript:void(0)"), skip, don't crash
    }
    // Stay within the same host.
    if (new URL(resolved).hostname !== base.hostname) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    links.push({ href: resolved, text: $(el).text().trim() });
  });

  // Remove noise and extract text.
  $("script, style, nav, footer, noscript").remove();
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CLEANED_TEXT_CHARS);

  return { url: baseUrl, text, links };
}
