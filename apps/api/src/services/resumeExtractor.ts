import type { Project, Experience, Skill, ResumeSchema } from "resume-core";

function normalizeGeminiModelName(model: string): string {
  return model.replace(/^models\//, "").trim();
}

async function pickGeminiGenerateContentModel(geminiBase: string, apiKey: string, preferred: string): Promise<string> {
  const preferredNorm = normalizeGeminiModelName(preferred);
  const listUrl = `${geminiBase}/models?key=${apiKey}`;

  const resp = await fetch(listUrl, { method: "GET" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ListModels failed (${resp.status}): ${text.substring(0, 200)}`);
  }

  const data = (await resp.json()) as any;
  const models = Array.isArray(data?.models) ? data.models : [];

  const supportsGenerateContent = (m: any) =>
    Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent");

  const candidates = models.filter(supportsGenerateContent);
  if (!candidates.length) {
    throw new Error("No Gemini models support generateContent");
  }

  const byName = (m: any) => normalizeGeminiModelName(String(m?.name ?? ""));

  const exact = candidates.find((m: any) => byName(m) === preferredNorm);
  if (exact) return byName(exact);

  const contains = candidates.find((m: any) => byName(m).includes(preferredNorm));
  if (contains) return byName(contains);

  const flash = candidates.find((m: any) => byName(m).includes("flash"));
  if (flash) return byName(flash);

  return byName(candidates[0]);
}

async function extractWithLLM(
  resumeText: string,
  section: "projects" | "experience" | "skills",
): Promise<Project[] | Experience[] | Skill[] | null> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!baseUrl || !apiKey) {
    console.log("[LLM] Skipped: LLM_BASE_URL or LLM_API_KEY not set");
    return null;
  }

  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  console.log(`[LLM] Extracting ${section} using ${model}...`);

  const prompts: Record<string, string> = {
    projects: `Extract all projects from this resume. For each project, return a JSON array with objects containing: title (optional string), description (string), technologies (string array), domain (optional: "web", "ml", "systems", "data", "other"), durationMonths (optional number), confidence (number 0-1). Only return valid JSON, no markdown.`,

    experience: `Extract all work experience/internships from this resume. For each role, return a JSON array with objects containing: role (string), company (string), durationMonths (optional number), description (string), technologies (string array), confidence (number 0-1). Only return valid JSON, no markdown.`,

    skills: `Extract all technical skills from this resume. Return a JSON array with objects containing: name (string), category (optional: "programming", "framework", "tool", "database", "ml", "cloud", "other"), confidence (number 0-1). Only return valid JSON, no markdown.`,
  };

  const prompt = prompts[section];
  if (!prompt) return null;

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a resume parser. Extract information accurately and return only valid JSON arrays. Be strict about confidence scores (lower if unclear).",
      },
      {
        role: "user",
        content: `${prompt}\n\nRESUME:\n${resumeText}`,
      },
    ],
    temperature: 0.1,
  };

  try {

    const isGeminiHost = baseUrl.includes("generativelanguage.googleapis.com");
    const isOpenAICompat = baseUrl.includes("/openai");
    const isGeminiNative = isGeminiHost && !isOpenAICompat;
    console.log(`[LLM] Using ${isGeminiNative ? "Gemini(native)" : "OpenAI-compatible"} API`);

    let url: string;
    let requestBody: string;
    let headers: Record<string, string>;

    if (isGeminiNative) {
      const base = baseUrl.replace(/\/+$/, "");
      const geminiBase = base.includes("/v1beta") ? base : `${base}/v1beta`;
      const modelName = normalizeGeminiModelName(model);
      url = `${geminiBase}/models/${modelName}:generateContent?key=${apiKey}`;
      requestBody = JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\nRESUME:\n${resumeText}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      });
      headers = {
        "Content-Type": "application/json",
      };
    } else {
      const openaiPath = isGeminiHost ? "/chat/completions" : "/v1/chat/completions";
      url = new URL(openaiPath, baseUrl).toString();
      requestBody = JSON.stringify(body);
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(isGeminiHost ? { "x-goog-api-key": apiKey } : {}),
      };
    }

    console.log(`[LLM] Fetching: ${url.split("?")[0]}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[LLM] Response status: ${resp.status}`);
      if (!resp.ok) {
        const errorText = await resp.text();
        console.log(`[LLM] Error response: ${errorText.substring(0, 300)}`);

        if (
          resp.status === 404 &&
          isGeminiNative &&
          baseUrl.includes("generativelanguage.googleapis.com")
        ) {
          try {
            const base = baseUrl.replace(/\/+$/, "");
            const geminiBase = base.includes("/v1beta") ? base : `${base}/v1beta`;
            const picked = await pickGeminiGenerateContentModel(geminiBase, apiKey, model);
            console.log(`[LLM] Retrying with model: ${picked}`);
            const retryUrl = `${geminiBase}/models/${picked}:generateContent?key=${apiKey}`;
            resp = await fetch(retryUrl, {
              method: "POST",
              headers,
              body: requestBody,
              signal: controller.signal,
            });
            console.log(`[LLM] Retry status: ${resp.status}`);
            if (!resp.ok) {
              const retryError = await resp.text();
              console.log(`[LLM] Retry error: ${retryError.substring(0, 300)}`);
              return null;
            }
          } catch (retryErr) {
            console.log(
              `[LLM] Model auto-pick failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
            );
            return null;
          }
        } else {
          return null;
        }
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.log(`[LLM] Request timeout (8s)`);
      } else {
        console.log(`[LLM] Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
      return null;
    }

    const data = (await resp.json()) as any;
    let text: string | undefined;

    if (isGeminiNative) {
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`[LLM] Gemini extracted text length: ${String(text).length}`);
    } else {
      text = data?.choices?.[0]?.message?.content;
      console.log(`[LLM] OpenAI extracted text length: ${String(text).length}`);
    }

    if (typeof text !== "string") {
      console.log(`[LLM] Failed to extract text from response, data keys: ${Object.keys(data)}`);
      return null;
    }

    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
      console.log(`[LLM] Extracted JSON from markdown fence`);
    }

    console.log(`[LLM] Attempting to parse JSON (length: ${jsonStr.length})`);
    const parsed = JSON.parse(jsonStr) as unknown[];
    console.log(`[LLM] Parsed successfully, array length: ${Array.isArray(parsed) ? parsed.length : "not an array"}`);
    if (!Array.isArray(parsed)) {
      console.log(`[LLM] Response was not an array`);
      return null;
    }

    if (section === "projects") {
      return parsed.map((p: any) => ({
        title: typeof p.title === "string" ? p.title : undefined,
        description: String(p.description ?? ""),
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        domain: p.domain,
        durationMonths:
          typeof p.durationMonths === "number" ? p.durationMonths : undefined,
        confidence: Math.min(1, Math.max(0, Number(p.confidence ?? 0.7))),
      })) as Project[];
    }

    if (section === "experience") {
      return parsed.map((e: any) => ({
        role: typeof e.role === "string" ? e.role : undefined,
        company: typeof e.company === "string" ? e.company : undefined,
        durationMonths:
          typeof e.durationMonths === "number" ? e.durationMonths : undefined,
        description: String(e.description ?? ""),
        technologies: Array.isArray(e.technologies) ? e.technologies : [],
        confidence: Math.min(1, Math.max(0, Number(e.confidence ?? 0.7))),
      })) as Experience[];
    }

    if (section === "skills") {
      return parsed.map((s: any) => ({
        name: String(s.name ?? ""),
        category: s.category,
        confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.7))),
      })) as Skill[];
    }

    return null;
  } catch (error) {
    console.log(`[LLM] Exception during extraction: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function enhanceSchemaWithLLM(
  schema: ResumeSchema,
  resumeText: string,
): Promise<ResumeSchema | null> {
  console.log(`[LLM] enhanceSchemaWithLLM called: projects=${schema.projects.length}, experience=${schema.experience.length}, skills=${schema.skills.length}`);
  try {
    const [projects, experience, skills] = await Promise.all([
      schema.projects.length === 0 ? (console.log(`[LLM] Extracting projects (empty array)`), extractWithLLM(resumeText, "projects")) : null,
      schema.experience.length === 0 ? (console.log(`[LLM] Extracting experience (empty array)`), extractWithLLM(resumeText, "experience")) : null,
      schema.skills.length === 0 ? (console.log(`[LLM] Extracting skills (empty array)`), extractWithLLM(resumeText, "skills")) : null,
    ]);

    console.log(`[LLM] LLM results: projects=${projects?.length ?? "null"}, experience=${experience?.length ?? "null"}, skills=${skills?.length ?? "null"}`);

    if (projects || experience || skills) {
      console.log(`[LLM] Returning enhanced schema`);
      return {
        ...schema,
        projects: projects && projects.length > 0 ? (projects as Project[]) : schema.projects,
        experience: experience && experience.length > 0 ? (experience as Experience[]) : schema.experience,
        skills: skills && skills.length > 0 ? (skills as Skill[]) : schema.skills,
      };
    }

    console.log(`[LLM] No results from LLM, returning null`);
    return null;
  } catch (error) {
    console.log(`[LLM] Exception in enhanceSchemaWithLLM: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
