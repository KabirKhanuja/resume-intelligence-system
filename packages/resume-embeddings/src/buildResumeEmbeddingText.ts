import type { ResumeSchema } from "resume-core";

export function buildResumeEmbeddingText(resume: ResumeSchema): string {
  return `
Skills: ${resume.skills.map(s => s.name).join(", ")}

Projects:
${resume.projects.map(p => `- ${p.description}`).join("\n")}

Experience:
${resume.experience.map(e => `- ${e.description}`).join("\n")}
`.trim();
}