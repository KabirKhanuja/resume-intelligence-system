import type { ResumeSchema } from "../schema/resume.schema.js";

export interface CohortComparisonResult {
  rank: number;
  total: number;
  percentile: number;

  comparisons: {
    skills: {
      student: number;
      average: number;
      missingCommon: string[];
    };
    projects: {
      student: number;
      average: number;
    };
    experience: {
      student: number;
      average: number;
    };
  };
}

export function compareToCohort(
  student: ResumeSchema,
  cohort: ResumeSchema[]
): CohortComparisonResult {
  const total = cohort.length;

  // ranking
  const scored = cohort.map(r => ({
    resumeId: r.meta.resumeId,
    score:
      r.skills.length * 2 +
      r.projects.length * 5 +
      r.experience.length * 4
  }));

  scored.sort((a, b) => b.score - a.score);

  const rank =
    scored.findIndex(r => r.resumeId === student.meta.resumeId) + 1;

  const percentile =
    Math.round(((total - rank) / total) * 100);

  // avgs
  const avgSkills = average(cohort.map(r => r.skills.length));
  const avgProjects = average(cohort.map(r => r.projects.length));
  const avgExperience = average(cohort.map(r => r.experience.length));

  // gap detection
  const commonSkills = findCommonSkills(cohort, 0.4); // 40% isd the threshold
  const studentSkillSet = new Set(student.skills.map(s => s.name));

  const missingCommon = commonSkills.filter(
    skill => !studentSkillSet.has(skill)
  );

  return {
    rank,
    total,
    percentile,

    comparisons: {
      skills: {
        student: student.skills.length,
        average: avgSkills,
        missingCommon
      },
      projects: {
        student: student.projects.length,
        average: avgProjects
      },
      experience: {
        student: student.experience.length,
        average: avgExperience
      }
    }
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((a, b) => a + b, 0) / values.length
  );
}

function findCommonSkills(
  cohort: ResumeSchema[],
  threshold: number
): string[] {
  const frequency = new Map<string, number>();

  for (const resume of cohort) {
    const uniqueSkills = new Set(resume.skills.map(s => s.name));
    for (const skill of uniqueSkills) {
      frequency.set(skill, (frequency.get(skill) ?? 0) + 1);
    }
  }

  const minCount = Math.ceil(cohort.length * threshold);

  return Array.from(frequency.entries())
    .filter(([, count]) => count >= minCount)
    .map(([skill]) => skill);
}