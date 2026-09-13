const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Every request includes credentials (the session cookie), the backend
 * uses server-side sessions, not tokens, so there's no header to attach
 * manually. Errors are normalized into ApiError so calling code can
 * branch on `error.code` the same way regardless of which endpoint failed.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Some error responses (network-level failures caught by a proxy,
    // for instance) may not be JSON at all, fall through to a generic error.
  }

  if (!response.ok) {
    const code = data?.error?.code || "UNKNOWN_ERROR";
    const message = data?.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, code, message);
  }

  return data as T;
}
