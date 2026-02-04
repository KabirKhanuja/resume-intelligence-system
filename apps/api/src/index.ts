import type { Prisma } from "@prisma/client";
import type { Socket } from "node:net";
import express from "express";
import multer from "multer";
import { prisma } from "./db.js";

import {
  buildResumeSchema,
  type ResumeSchema,
  scoreResume,
  compareToCohort,
} from "resume-core";

import { cosineSimilarity, embedText } from "resume-embeddings";

type GapSummary = {
  missingSkills: string[];
  commonProjectDomains: string[];
  missingProjectDomains: string[];
  experienceGap: string | null;
  structureGaps: string[];
};

type GapEvidence = {
  groupSize: number;
  commonSkills: Array<{ skill: string; count: number }>;
  commonDomains: Array<{ domain: string; count: number }>;
  commonSections: Array<{ section: string; count: number }>;
};

function toResumeSchema(value: Prisma.JsonValue): ResumeSchema | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ResumeSchema>;
  if (!candidate.meta || typeof candidate.meta !== "object") return null;
  if (typeof (candidate.meta as any).resumeId !== "string") return null;
  return value as unknown as ResumeSchema;
}

function toEmbedding(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  return value as number[];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractSkills(schema: ResumeSchema): string[] {
  return (schema.skills ?? [])
    .map((s) => s?.name)
    .filter((v): v is string => typeof v === "string")
    .map(normalizeToken)
    .filter(Boolean);
}

function inferProjectDomain(text: string): string | null {
  const t = normalizeToken(text);
  const rules: Array<[string, RegExp]> = [
    ["Machine Learning", /(machine learning|ml|deep learning|nlp|computer vision|pytorch|tensorflow|transformer)/],
    ["Web", /(react|next\.js|frontend|web app|ui|html|css|tailwind|angular|vue)/],
    ["Backend", /(api|rest|graphql|microservice|express|fastapi|django|spring|backend)/],
    ["Data", /(data pipeline|etl|spark|hadoop|data analysis|pandas|analytics)/],
    ["DevOps", /(docker|kubernetes|ci\/cd|devops|terraform|aws|gcp|azure)/],
    ["Mobile", /(android|ios|flutter|react native)/],
    ["Security", /(security|oauth|jwt|encryption|vulnerability)/],
  ];
  for (const [label, re] of rules) {
    if (re.test(t)) return label;
  }
  return null;
}

function extractProjectDomains(schema: ResumeSchema): string[] {
  const domains: string[] = [];
  for (const p of schema.projects ?? []) {
    if (p?.domain) {
      domains.push(titleCase(normalizeToken(p.domain)));
      continue;
    }
    const inferred = inferProjectDomain(
      [p?.title ?? "", p?.description ?? "", ...(p?.technologies ?? [])].join(" "),
    );
    if (inferred) domains.push(inferred);
  }
  return domains;
}

function sectionPresence(schema: ResumeSchema): Record<string, boolean> {
  return {
    Certifications: (schema.certifications ?? []).length > 0,
    Achievements: (schema.achievements ?? []).length > 0,
    Experience: (schema.experience ?? []).length > 0,
    Projects: (schema.projects ?? []).length > 0,
    Skills: (schema.skills ?? []).length > 0,
    Summary: (schema.rawSections ?? []).some((s) => s.mappedTo === "summary"),
    Positions: (schema.rawSections ?? []).some((s) => s.mappedTo === "positions"),
  };
}

async function summarizeGapsWithLLM(gaps: GapSummary, context: string): Promise<string[] | null> {
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
      { role: "user", content: `${context}\n\nGAPS_JSON:\n${JSON.stringify(gaps, null, 2)}\n\n${prompt}` },
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

function fallbackAdvice(gaps: GapSummary): string[] {
  const bullets: string[] = [];
  if (gaps.missingSkills.length) {
    bullets.push(
      `Add or highlight these common skills: ${gaps.missingSkills.slice(0, 6).join(", ")}.`,
    );
  }
  if (gaps.missingProjectDomains.length) {
    bullets.push(
      `Add a project aligned with: ${gaps.missingProjectDomains.slice(0, 3).join(", ")}.`,
    );
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

const app = express();
const upload = multer();
app.use(express.json());

// resume parsing api 
app.post("/resume/parse", upload.none(), async (req, res) => {
  const { text, meta } = req.body as { text?: string; meta?: any };
  if (!text) return res.status(400).json({ error: "resume text required" });

  const schema = buildResumeSchema(text, meta);
  const score = scoreResume(schema).totalScore;

  const saved = await prisma.resume.create({
    data: {
      id: schema.meta.resumeId,
      studentId: schema.meta.studentId ?? null,
      batch: schema.meta.batch ?? null,
      department: schema.meta.department ?? null,
      schema: schema as unknown as Prisma.InputJsonValue,
      score
    }
  });
  res.json(saved);
});

// student score 
app.post("/student/score", async (req, res) => {
  const { resumeId } = req.body as { resumeId?: string };
  if (!resumeId) return res.status(400).json({ error: "resumeId required" });

  const row = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!row) return res.status(404).json({ error: "not found" });

  const schema = toResumeSchema(row.schema);
  if (!schema) return res.status(500).json({ error: "invalid schema in db" });

  const score = scoreResume(schema);
  res.json(score);
});

// comparing
app.post("/student/compare", async (req, res) => {
  const { resumeId } = req.body as { resumeId?: string };
  if (!resumeId) return res.status(400).json({ error: "resumeId required" });

  const student = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!student) return res.status(404).json({ error: "not found" });

  const cohort = await prisma.resume.findMany({
    where: {
      batch: student.batch,
      department: student.department
    }
  });

  const studentSchema = toResumeSchema(student.schema);
  const cohortSchemas = cohort
    .map(r => toResumeSchema(r.schema))
    .filter((s): s is ResumeSchema => Boolean(s));

  if (!studentSchema) {
    return res.status(500).json({ error: "invalid schema in db" });
  }

  const comparison = compareToCohort(
    studentSchema,
    cohortSchemas
  );

  res.json(comparison);
});

// deterministic gaps + llm summary logic
app.post("/student/missing", async (req, res) => {
  const { resumeId, jdText, topN = 10, mode } = req.body as {
    resumeId?: string;
    jdText?: string;
    topN?: number;
    mode?: "score" | "jd";
  };

  if (!resumeId) return res.status(400).json({ error: "resumeId required" });

  const limit = typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

  const studentRow = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!studentRow) return res.status(404).json({ error: "not found" });

  const studentSchema = toResumeSchema(studentRow.schema);
  if (!studentSchema) return res.status(500).json({ error: "invalid schema in db" });

  const cohortWhere = {
    batch: studentRow.batch,
    department: studentRow.department,
    NOT: { id: resumeId },
  } as const;

  let groupRows: Array<{ id: string; schema: Prisma.JsonValue; score: number; embedding: Prisma.JsonValue | null }> = [];
  let groupMode: "score" | "jd" = mode === "jd" && jdText ? "jd" : "score";

  if (groupMode === "jd") {
    // Top-N most similar that is the cached embeddings within the cohort
    let jdEmbedding: number[];
    try {
      jdEmbedding = await embedText(jdText!);
    } catch {
      return res.status(503).json({ error: "embeddings server unavailable" });
    }

    const rows = await prisma.resume.findMany({
      where: { ...cohortWhere, embeddingStatus: "done" },
      select: { id: true, embedding: true, schema: true, score: true },
    });

    groupRows = rows
      .map((r) => {
        const emb = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
        if (!emb) return null;
        return { ...r, embedding: r.embedding, similarity: cosineSimilarity(jdEmbedding, emb) };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity: _s, ...rest }) => rest);
  } else {
    // top n peers by score within the cohort
    groupRows = await prisma.resume.findMany({
      where: cohortWhere,
      select: { id: true, schema: true, score: true, embedding: true },
      orderBy: { score: "desc" },
      take: limit,
    });
  }

  const groupSchemas = groupRows
    .map((r) => toResumeSchema(r.schema))
    .filter((s): s is ResumeSchema => Boolean(s));

  if (groupSchemas.length === 0) {
    return res.json({
      group: { mode: groupMode, size: 0, batch: studentRow.batch, department: studentRow.department },
      gaps: {
        missingSkills: [],
        commonProjectDomains: [],
        missingProjectDomains: [],
        experienceGap: null,
        structureGaps: [],
      } satisfies GapSummary,
      adviceBullets: ["Not enough peer resumes available to compare."],
      evidence: { groupSize: 0, commonSkills: [], commonDomains: [], commonSections: [] } satisfies GapEvidence,
    });
  }

  const groupSize = groupSchemas.length;
  const minCount = Math.max(1, Math.ceil(groupSize * 0.5)); // “common” = present in >= 50%

  // Skill gaps
  const studentSkills = new Set(extractSkills(studentSchema));
  const skillCounts = new Map<string, number>();
  for (const s of groupSchemas) {
    for (const skill of new Set(extractSkills(s))) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }

  const commonSkills = [...skillCounts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({ skill, count }));

  const missingSkills = commonSkills
    .map((s) => s.skill)
    .filter((skill) => !studentSkills.has(skill))
    .slice(0, 12)
    .map(titleCase);

  // Project domains
  const studentDomains = new Set(extractProjectDomains(studentSchema));
  const domainCounts = new Map<string, number>();
  for (const s of groupSchemas) {
    for (const d of new Set(extractProjectDomains(s))) {
      domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
  }

  const commonDomains = [...domainCounts.entries()]
    .filter(([, c]) => c >= Math.max(2, Math.ceil(groupSize * 0.4)))
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));

  const missingProjectDomains = commonDomains
    .map((d) => d.domain)
    .filter((d) => !studentDomains.has(d))
    .slice(0, 6);

  // Experience gap (simple)
  const studentHasExp = (studentSchema.experience ?? []).length > 0;
  const groupHasExpCount = groupSchemas.filter((s) => (s.experience ?? []).length > 0).length;
  const experienceGap =
    !studentHasExp && groupHasExpCount >= minCount
      ? "Top peers commonly list internships/experience. Consider adding internships, freelance work, or relevant roles with measurable impact."
      : null;

  // Structure gaps
  const studentSections = sectionPresence(studentSchema);
  const sectionCounts = new Map<string, number>();
  for (const s of groupSchemas) {
    const presence = sectionPresence(s);
    for (const [section, present] of Object.entries(presence)) {
      if (!present) continue;
      sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    }
  }

  const commonSections = [...sectionCounts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([section, count]) => ({ section, count }));

  const structureGaps = commonSections
    .map((s) => s.section)
    .filter((section) => !studentSections[section])
    .slice(0, 6);

  const gaps: GapSummary = {
    missingSkills,
    commonProjectDomains: commonDomains.map((d) => d.domain).slice(0, 6),
    missingProjectDomains,
    experienceGap,
    structureGaps,
  };

  const evidence: GapEvidence = {
    groupSize,
    commonSkills: commonSkills.slice(0, 12).map((s) => ({ skill: titleCase(s.skill), count: s.count })),
    commonDomains: commonDomains.slice(0, 8),
    commonSections: commonSections.slice(0, 8),
  };

  const context = `Compared to the top ${groupSize} resumes in batch=${studentRow.batch ?? "?"}, department=${studentRow.department ?? "?"} (mode=${groupMode}).`;
  let adviceBullets: string[];
  try {
    adviceBullets = (await summarizeGapsWithLLM(gaps, context)) ?? fallbackAdvice(gaps);
  } catch {
    adviceBullets = fallbackAdvice(gaps);
  }

  res.json({
    group: { mode: groupMode, size: groupSize, batch: studentRow.batch, department: studentRow.department },
    gaps,
    adviceBullets,
    evidence,
  });
});

// for tpo shortlist
app.post("/tpo/shortlist", async (req, res) => {
  const { jdText, topN = 10 } = req.body as { jdText?: string; topN?: number };
  if (!jdText) return res.status(400).json({ error: "JD text required" });

  const limit =
    typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

  const rows = await prisma.resume.findMany({
    where: { embeddingStatus: "done" },
    select: { id: true, embedding: true, schema: true, score: true },
  });

  if (rows.length === 0) return res.json([]);

  let jdEmbedding: number[];
  try {
    jdEmbedding = await embedText(jdText);
  } catch (e) {
    return res.status(503).json({
      error: "embeddings server unavailable",
    });
  }

  const scored = rows
    .map((r) => {
      const embedding = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
      if (!embedding) return null;

      return {
        resumeId: r.id,
        similarity: cosineSimilarity(jdEmbedding, embedding),
        score: r.score,
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  res.json(
    scored.map((r) => ({
      resumeId: r.resumeId,
      matchScore: Number(r.similarity.toFixed(4)),
      baseScore: r.score,
    })),
  );
});

const server = app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});

const sockets = new Set<Socket>();
server.on("connection", (socket: Socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

let isShuttingDown = false;
const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    console.log(`\nReceived ${signal}. Shutting down...`);

    // stop accepting new connections
    server.close(() => undefined);

    for (const socket of sockets) socket.destroy();

    void prisma.$disconnect().catch(() => undefined);

    process.exit(0);
  } catch {
    process.exit(0);
  }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));