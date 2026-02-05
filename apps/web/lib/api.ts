export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const DEBUG = process.env.NEXT_PUBLIC_DEBUG === "1";

function debugLog(message: string, extra?: unknown) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(message, extra ?? "");
}

async function parseJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const startedAt = performance.now();
  debugLog(`[WEB->API] POST ${path} (json)`);
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

  const parsed = await parseJsonSafely(res);
  debugLog(`[WEB->API] POST ${path} -> ${res.status} (${Math.round(performance.now() - startedAt)}ms)`);
  if (!res.ok) {
    const message =
      typeof parsed === "object" && parsed && "error" in parsed && typeof (parsed as any).error === "string"
        ? (parsed as any).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}

export async function uploadFile<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const startedAt = performance.now();
  debugLog(`[WEB->API] POST ${path} (multipart)`);
  const res = await fetch(path, {
    method: "POST",
    body: formData,
    ...init,
  });

  const parsed = await parseJsonSafely(res);
  debugLog(`[WEB->API] POST ${path} -> ${res.status} (${Math.round(performance.now() - startedAt)}ms)`);
  if (!res.ok) {
    const message =
      typeof parsed === "object" && parsed && "error" in parsed && typeof (parsed as any).error === "string"
        ? (parsed as any).error
        : `Upload failed (${res.status})`;
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}
