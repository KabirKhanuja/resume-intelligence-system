import type { GapSummary } from "./gaps.js";

export type LlmProviderConfig =
  | {
      kind: "gemini";
      label: string;
      baseUrl: string;
      apiKey: string;
      model: string;
    }
  | {
      kind: "openai-compatible";
      label: string;
      baseUrl: string;
      apiKey?: string;
      model: string;
    };

export type LlmSummaryResult = {
  bullets: string[];
  provider: string;
  model: string;
};

function cleanBullet(text: string): string {
  let t = text.trim();

  // strip wrapping quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }

  // remove common markdown emphasis
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");

  // remove model-preface / meta phrases
  t = t.replace(/^based on the provided\s+gaps_json[:,]?\s*/i, "");
  t = t.replace(/^here are some actionable resume improvement advice[:,]?\s*/i, "");
  t = t.replace(/^actionable resume improvement advice[:,]?\s*/i, "");

  // avoid internal field names leaking into UX
  t = t.replace(/\bGAPS_JSON\b/gi, "gaps analysis");
  t = t.replace(/\bmissingSkills\b/g, "missing skills");
  t = t.replace(/\bmissingProjectDomains\b/g, "missing project domains");
  t = t.replace(/\bcommonProjectDomains\b/g, "common project domains");
  t = t.replace(/\bstructureGaps\b/g, "structure gaps");

  return t.trim();
}

function normalizeToken(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9+.#/\s-]/g, "").trim();
}

function containsAnyConcreteItem(text: string, items: string[]): boolean {
  const hay = normalizeToken(text);
  return items.some((it) => {
    const needle = normalizeToken(it);
    return needle.length >= 3 && hay.includes(needle);
  });
}

function llmBulletsAreUseful(bullets: string[], gaps: GapSummary): boolean {
  const joined = bullets.join(" \n ");

  if (gaps.missingSkills.length > 0) {
    // If we have concrete missing skills, require mentioning at least one.
    if (!containsAnyConcreteItem(joined, gaps.missingSkills.slice(0, 20))) return false;
  }

  if (gaps.missingProjectDomains.length > 0) {
    if (!containsAnyConcreteItem(joined, gaps.missingProjectDomains.slice(0, 20))) return false;
  }

  // Reject obviously meta / templated responses.
  if (/\b(based on|provided)\b.*\b(gaps|json)\b/i.test(joined)) return false;
  if (/\breview\b.*\blist\b/i.test(joined)) return false;

  return true;
}

function splitBullets(text: string): string[] {
  const bullets = text
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*[-*\u2022]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .trim(),
    )
    .filter(Boolean);

  const cleaned = bullets
    .map(cleanBullet)
    .filter((b) => Boolean(b) && b.length >= 8)
    .slice(0, 8);

  return cleaned;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalizeGeminiBaseUrl(rawBaseUrl: string): string {
  // Accept either:
  // - https://generativelanguage.googleapis.com
  // - https://generativelanguage.googleapis.com/v1beta
  // - https://generativelanguage.googleapis.com/v1
  try {
    const u = new URL(rawBaseUrl);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = "/v1beta";
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return rawBaseUrl;
  }
}

async function trySummarizeWithGemini(provider: Extract<LlmProviderConfig, { kind: "gemini" }>, userText: string) {
  const baseUrl = normalizeGeminiBaseUrl(provider.baseUrl);

  const url = new URL(`/models/${provider.model}:generateContent`, baseUrl);
  url.searchParams.set("key", provider.apiKey);

  const body = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.2 },
  };

  const resp = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    12_000,
  );

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) return null;

  const bullets = splitBullets(text);
  return bullets.length ? bullets : null;
}

async function trySummarizeWithOpenAiCompat(
  provider: Extract<LlmProviderConfig, { kind: "openai-compatible" }>,
  userText: string,
) {
  const body = {
    model: provider.model,
    messages: [
      { role: "system", content: "You are a helpful career coach." },
      { role: "user", content: userText },
    ],
    temperature: 0.2,
  };

  const url = new URL("/v1/chat/completions", provider.baseUrl).toString();
  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    },
    12_000,
  );

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return null;

  const bullets = splitBullets(text);
  return bullets.length ? bullets : null;
}

export async function summarizeGapsWithLLM(
  gaps: GapSummary,
  context: string,
  providers?: LlmProviderConfig[],
): Promise<LlmSummaryResult | null> {
  const fromEnv: LlmProviderConfig[] = [];

  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  if (baseUrl && apiKey) {
    fromEnv.push(
      baseUrl.includes("generativelanguage.googleapis.com")
        ? { kind: "gemini", label: "gemini", baseUrl, apiKey, model }
        : { kind: "openai-compatible", label: "primary", baseUrl, apiKey, model },
    );
  }

  // Optional local Ollama fallback.
  // Ollama supports an OpenAI-compatible API at: http://localhost:11434/v1/chat/completions
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2:latest";
  const ollamaApiKey = process.env.OLLAMA_API_KEY;
  if (ollamaBaseUrl) {
    fromEnv.push({
      kind: "openai-compatible",
      label: "ollama",
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      ...(ollamaApiKey ? { apiKey: ollamaApiKey } : {}),
    });
  }

  const chain = (providers?.length ? providers : fromEnv).filter(Boolean);
  if (chain.length === 0) return null;

  const prompt =
    "You are reviewing a college student's resume gaps against peers. " +
    "Return 5-7 short bullet points. No intro text. No quotes. No markdown. " +
    "Each bullet must be specific and actionable and must reference concrete items from the data when available " +
    "(e.g., name 3-6 missing skills, name 1-3 missing project domains). " +
    "Avoid generic advice like 'review the list' — instead, include the actual items. " +
    "If a list is empty, skip it and focus on quantified impact, project framing, and structure.";

  const userText = `${context}\n\nGAPS_JSON:\n${JSON.stringify(gaps, null, 2)}\n\n${prompt}`;

  for (const provider of chain) {
    try {
      const bullets =
        provider.kind === "gemini"
          ? await trySummarizeWithGemini(provider, userText)
          : await trySummarizeWithOpenAiCompat(provider, userText);
      if (bullets && bullets.length && llmBulletsAreUseful(bullets, gaps)) {
        return { bullets, provider: provider.label, model: provider.model };
      }
    } catch {
      // Try next provider in chain.
    }
  }

  return null;
}

export function fallbackAdvice(gaps: GapSummary): string[] {
  const bullets: string[] = [];
  if (gaps.missingSkills.length) {
    bullets.push(
      `Add 3–6 of these cohort-common skills (only if true): ${gaps.missingSkills
        .slice(0, 6)
        .join(", ")}. Show evidence by mentioning them in a project bullet (tool + what you built).`,
    );
  }
  if (gaps.missingProjectDomains.length) {
    bullets.push(
      `Add 1 project aligned with: ${gaps.missingProjectDomains
        .slice(0, 3)
        .join(", ")}. Write it as: Action + Tech + Metric (e.g., “Built X using Y, improved Z by 20%”).`,
    );
  } else if (gaps.commonProjectDomains.length) {
    bullets.push(
      `Peers often have projects in: ${gaps.commonProjectDomains
        .slice(0, 3)
        .join(", ")}. If you have similar work, reframe your projects to match those domains clearly in the title + first bullet.`,
    );
  }
  if (gaps.experienceGap) {
    bullets.push(cleanBullet(gaps.experienceGap));
  }
  for (const s of gaps.structureGaps.slice(0, 3)) {
    bullets.push(
      `Fix structure: add/rename a “${s}” section (if applicable) and keep sections ordered: Education → Skills → Projects → Experience.`,
    );
  }

  // Always push a concrete writing-quality bullet.
  bullets.push(
    "Add measurable impact in each project/role (numbers, scale, latency, users, revenue, accuracy). Replace vague verbs like “worked on” with outcomes.",
  );

  if (!bullets.length) {
    bullets.push("Your resume is broadly aligned with your top peers. Focus on clarity and measurable impact.");
  }

  return bullets
    .map(cleanBullet)
    .filter(Boolean)
    .slice(0, 7);
}
