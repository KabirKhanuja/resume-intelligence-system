import type { ResumeSchema } from "../schema/resume.schema.js";
import type { ParsedJD } from "./parseJD.js";

export function scoreResumeAgainstJD(
  resume: ResumeSchema,
  jd: ParsedJD
) {
  let score = 0;
  const reasons: string[] = [];

  const resumeSkills = new Set(resume.skills.map(s => s.name));

  // skills match
  const matchedSkills = jd.skills.filter(skill =>
    resumeSkills.has(skill)
  );

  if (jd.skills.length > 0) {
    const skillScore =
      (matchedSkills.length / jd.skills.length) * 60;

    score += skillScore;

    if (matchedSkills.length > 0) {
      reasons.push(
        `Matched ${matchedSkills.length}/${jd.skills.length} required skills`
      );
    }
  }

  // proj
  if (resume.projects.length > 0) {
    score += Math.min(25, resume.projects.length * 12);
    reasons.push("Relevant project experience");
  }

  // exp 
  if (resume.experience.length > 0) {
    score += Math.min(15, resume.experience.length * 15);
    reasons.push("Industry experience present");
  }

  return {
    resumeId: resume.meta.resumeId,
    score: Math.round(score),
    reasons
  };
}