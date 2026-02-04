import type { GapSummary } from "./gaps.js";

export async function summarizeGapsWithLLM(
  gaps: GapSummary,
  context: string,
): Promise<string[] | null> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  if (!baseUrl || !apiKey) return null;

  const prompt =
    "Summarize this into actionable resume improvement advice for a college student. " +
    "Be concise. Use 5-6 bullet points. Do not invent facts. Base everything only on the provided gaps object.";

  const body = {
    model,
    messages: [
      { role: "system", content: "You are a helpful career coach." },
      {
        role: "user",
        content: `${context}\n\nGAPS_JSON:\n${JSON.stringify(gaps, null, 2)}\n\n${prompt}`,
      },
    ],
    temperature: 0.2,
  };

  const url = new URL("/v1/chat/completions", baseUrl).toString();
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return null;

  const bullets = text
    .split(/\r?\n/)
    .map((l: string) => l.replace(/^\s*[-*\u2022]\s+/, "").trim())
    .filter(Boolean);

  return bullets.length ? bullets.slice(0, 8) : null;
}

export function fallbackAdvice(gaps: GapSummary): string[] {
  const bullets: string[] = [];
  if (gaps.missingSkills.length) {
    bullets.push(`Add or highlight these common skills: ${gaps.missingSkills.slice(0, 6).join(", ")}.`);
  }
  if (gaps.missingProjectDomains.length) {
    bullets.push(`Add a project aligned with: ${gaps.missingProjectDomains.slice(0, 3).join(", ")}.`);
  }
  if (gaps.experienceGap) {
    bullets.push(gaps.experienceGap);
  }
  for (const s of gaps.structureGaps.slice(0, 3)) {
    bullets.push(`Consider adding a ${s} section if applicable.`);
  }
  if (!bullets.length) {
    bullets.push("Your resume is broadly aligned with your top peers. Focus on clarity and measurable impact.");
  }
  return bullets.slice(0, 6);
}
