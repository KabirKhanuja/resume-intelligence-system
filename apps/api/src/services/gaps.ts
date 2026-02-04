import type { ResumeSchema } from "resume-core";

export type GapSummary = {
  missingSkills: string[];
  commonProjectDomains: string[];
  missingProjectDomains: string[];
  experienceGap: string | null;
  structureGaps: string[];
};

export type GapEvidence = {
  groupSize: number;
  commonSkills: Array<{ skill: string; count: number }>;
  commonDomains: Array<{ domain: string; count: number }>;
  commonSections: Array<{ section: string; count: number }>;
};

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
    [
      "Machine Learning",
      /(machine learning|ml|deep learning|nlp|computer vision|pytorch|tensorflow|transformer)/,
    ],
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

export function computeGapSummary(studentSchema: ResumeSchema, groupSchemas: ResumeSchema[]): {
  gaps: GapSummary;
  evidence: GapEvidence;
} {
  const groupSize = groupSchemas.length;
  const minCount = Math.max(1, Math.ceil(groupSize * 0.5));

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

  const studentHasExp = (studentSchema.experience ?? []).length > 0;
  const groupHasExpCount = groupSchemas.filter((s) => (s.experience ?? []).length > 0).length;
  const experienceGap =
    !studentHasExp && groupHasExpCount >= minCount
      ? "Top peers commonly list internships/experience. Consider adding internships, freelance work, or relevant roles with measurable impact."
      : null;

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

  return { gaps, evidence };
}
