import type { ResumeSchema } from "resume-core";

export function buildResumeEmbeddingText(schema: ResumeSchema): string {
  const skills = schema.skills?.map((s) => s.name).filter(Boolean).join(", ") ?? "";

  const projects = (schema.projects ?? [])
    .map((p) => {
      const title = p.title ? `Title: ${p.title}` : "";
      const tech = (p.technologies ?? []).length ? `Tech: ${(p.technologies ?? []).join(", ")}` : "";
      const desc = p.description ? `Details: ${p.description}` : "";
      return [title, tech, desc].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const experience = (schema.experience ?? [])
    .map((e) => {
      const role = e.role ? `Role: ${e.role}` : "";
      const company = e.company ? `Company: ${e.company}` : "";
      const tech = (e.technologies ?? []).length ? `Tech: ${(e.technologies ?? []).join(", ")}` : "";
      const desc = e.description ? `Details: ${e.description}` : "";
      return [role, company, tech, desc].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const importantSections = new Set(["summary", "skills", "experience", "projects", "education"]);
  const raw = (schema.rawSections ?? [])
    .filter((s) => !s.mappedTo || importantSections.has(s.mappedTo))
    .map((s) => `${s.heading}\n${s.content}`.trim())
    .filter(Boolean)
    .join("\n\n");

  const text = [
    skills ? `Skills: ${skills}` : "",
    experience ? `Experience:\n${experience}` : "",
    projects ? `Projects:\n${projects}` : "",
    raw ? `Raw:\n${raw}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return text.slice(0, 12_000);
}