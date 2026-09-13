# AI Interview Prep Kit

A full-stack web app that turns a job description into a personalised interview preparation kit, a company brief, role breakdown, categorised question bank, flashcards, and a day-by-day study schedule, by crawling the company's site and researching their hiring process.

## Tech Stack

- **Frontend:** Next.js + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB
- **LLM Provider:** Google Gemini (`gemini-3.5-flash-lite` by default, configurable via `LLM_MODEL`), free tier
- **Scraping:** Cheerio-based crawler with weighted-keyword link scoring (not a fixed path list)

## Setup

### Local development

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # fill in MongoDB URI, LLM API key, JWT secret
npm run dev
```
Runs on `http://localhost:4000`.

**Frontend:**
```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev
```
Runs on `http://localhost:3000`.

### Batch entry point

Runs the full retrieval + generation + validation pipeline over a set of cases without going through the UI:

```bash
cd backend
npm install
cp .env.example .env
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Input/output shapes follow Appendix B of the assessment brief. Continues past individual case failures and records them in the output rather than aborting the run.

### Deployed

- **Frontend:** [FILL IN, Vercel URL]
- **Backend:** [FILL IN, Render/Railway URL]

## Architecture

- `backend/src/lib/`, retrieval, extraction, generation, and scheduling logic, kept as separate concerns
  - `generateQuestions.ts`, generates questions per requirement/category
  - `pipeline.ts`, orchestrates the research → generation → coverage-check sequence
  - `schedule.ts`, deterministic day-by-day allocation (not left to the model)
  - `regenerateMerge.ts`, merges a section regeneration with existing edits/pins
- `backend/src/routes/`, Express routes (`kitBuilder.ts`, `kits.ts`, auth)
- `frontend/src/`, Next.js app, components for question/flashcard editing, practice mode, dashboard

## Research & Generation Sequence

1. Extract requirements from the pasted job description (marked `must`/`nice` based on how the posting words them)
2. Crawl the company site to find an about/hiring page, link discovery, not a fixed path list
3. Search for public discussion of the company's interview process
4. Generate questions per requirement and category (technical, behavioural, system-design, company-fit), separate calls per category rather than one combined prompt
5. **Coverage check (deterministic, in code):** compare generated questions against extracted requirements; any uncovered requirement triggers a second generation pass targeting just the gap
6. Allocate the resulting questions across the requested number of days (deterministic arithmetic, harder/higher-priority material scheduled earlier)

## State: Generated / Edited / Pinned

Each question tracks whether it was **generated**, **edited** by the user, or explicitly **pinned**. Regenerating a single category re-runs generation only for untouched questions; edited and pinned questions are preserved and re-merged back in (`regenerateMerge.ts`), so a regeneration never discards work the user has done elsewhere.

## Practice Mode

Users step through flashcards, rate confidence per card, and the next session is ordered by lowest confidence first, a simple confidence-weighted resurfacing rather than a full spaced-repetition interval, chosen for simplicity given the timebox.

## Security & Crawler Protection

- **SSRF protection (`urlSafety.ts`):** in production, hostnames are DNS-resolved and checked against private IPv4 ranges (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and IPv6 unique-local (`fc00::/7`). Only `http:`/`https:` protocols are allowed. In non-production (`NODE_ENV !== "production"`), this check is skipped so the batch CLI can crawl a locally-served test site per Section 9 of the brief.
- `robots.txt` is checked per-origin before crawling; disallowed pages are skipped, not fetched
- Fetches are capped at 2MB and restricted to `text/html`/`text/plain`, with an 8s timeout per page
- Crawled and pasted text is explicitly framed to the LLM as data to analyze, not instructions to follow (see `extractRequirements.ts` prompt)

## Coverage Passes

Capped at exactly **2 passes**: one initial generation pass, then one targeted pass at whatever requirements are still uncovered. Chosen as a bounded loop rather than "retry until covered," since an unbounded loop against a rate-limited free-tier LLM risks never terminating if the model keeps missing the same gap.

## Edge Cases Handled

- Invalid/unreachable company URL → recorded as a research gap, not a fatal error
- No discoverable hiring page → honest brief stating this, not fabricated content
- Thin job descriptions → thin kit reflecting that, no invented requirements
- LLM rate limits / transient failures → retried with exponential backoff (up to 4 retries)
- Duplicate submissions → [FILL IN your actual dedup approach if implemented]

## Known Limitations

- SSRF checks only run when `NODE_ENV=production`; local/dev crawling (including the batch CLI's local test-fixture server) skips the private-IP check by design
- [FILL IN, e.g. crawler stays same-host only, no cross-domain handbook following; single free-tier LLM key means shared rate limits across users]

## Future Improvements

- **Close the DNS-rebinding window:** `assertSafeUrl` currently validates DNS resolution once, then `fetchPage` re-resolves and connects separately, a malicious host could theoretically resolve to a safe IP at validation time and a private IP at fetch time. The fix is to pin the resolved IP from `assertSafeUrl` and pass it directly into the fetch (e.g. via a custom DNS resolver or `agent`/`lookup` override), rather than trusting a second independent resolution.
- [FILL IN any other roadmap items, e.g. cross-domain crawling for handbooks hosted on a separate site, spaced-repetition intervals instead of confidence-weighted ordering, multi-LLM fallback if Gemini's free tier is exhausted]

## Testing

```bash
cd backend
npx tsc --noEmit
npx vitest run
```