import robotsParser from "robots-parser";

const USER_AGENT = "InterviewPrepKitBot/1.0";
const ROBOTS_FETCH_TIMEOUT_MS = 5000;

export interface RobotsChecker {
  isAllowed(url: string): boolean;
}

/// Loads and parses a site's robots.txt, returning a checker that can be used to
/// determine whether a given URL is allowed to be crawled. If the robots.txt
/// cannot be fetched or parsed, returns a checker that allows all URLs.
export async function loadRobotsRules(origin: string): Promise<RobotsChecker> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(robotsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { isAllowed: () => true };
    }

    const body = await response.text();
    const parsed = robotsParser(robotsUrl, body);
    return {
      isAllowed: (url: string) => parsed.isAllowed(url, USER_AGENT) ?? true,
    };
  } catch {
    clearTimeout(timeout);
    return { isAllowed: () => true };
  }
}

export { USER_AGENT };
