import type { ResumeSchema } from "../schema/resume.schema.js";
import { parseJD } from "./parseJD.js";
import { scoreResumeAgainstJD } from "./scoreResumeAgainstJD.js";

export interface JDMatchResult {
  resumeId: string;
  score: number;
  reasons: string[];
}

export function matchJDToResumes(
  jdText: string,
  resumes: ResumeSchema[],
  topN = 10
): JDMatchResult[] {
  const parsedJD = parseJD(jdText);

  const results: JDMatchResult[] = resumes.map(resume =>
    scoreResumeAgainstJD(resume, parsedJD)
  );

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}