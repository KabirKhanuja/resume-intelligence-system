export async function embedText(text: string): Promise<number[]> {
  const baseUrl =
    process.env.RESUME_EMBEDDINGS_URL ??
    process.env.EMBEDDINGS_URL ??
    "http://127.0.0.1:8001";

  const endpoint = new URL("/embed", baseUrl).toString();

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(
      [
        `embedText(): failed to reach embeddings server at ${endpoint}`,
        `Original error: ${message}`,
        "Start the local server with:",
        "  cd infra/embeddings && python3 -m uvicorn server:app --host 127.0.0.1 --port 8001",
      ].join("\n"),
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Embeddings server error ${res.status} ${res.statusText}: ${body.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as { embedding?: unknown };
  if (!Array.isArray(data.embedding)) {
    throw new Error("Embeddings server response missing 'embedding' array");
  }
  return data.embedding as number[];
}