import type { ResumeSchema } from "resume-core";

export function buildResumeEmbeddingText(schema: ResumeSchema): string {
  const skills = schema.skills?.map(s => s.name).join(", ") ?? "";
  const projects = schema.projects?.map(p => p.title).join(", ") ?? "";
  const experience = schema.experience?.map(e => e.role).join(", ") ?? "";

  return `
Skills: ${skills}
Projects: ${projects}
Experience: ${experience}
`.trim();
}