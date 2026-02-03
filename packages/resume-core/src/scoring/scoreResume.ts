import type { ResumeSchema, Skill } from "../schema/resume.schema.js";

export interface ResumeScore {
    totalScore: number;
    breakdown: {
        skills: number;
        projects: number;
        experience: number;
        structure: number;
    };
}

export function scoreResume(resume: ResumeSchema): ResumeScore {
    const skillsScore = scoreSkills(resume.skills);
    const projectsScore = scoreProjects(resume.projects);
    const experienceScore = scoreExperience(resume.experience);
    const structureScore = scoreStructure(resume);

    const totalScore =
        skillsScore +
        projectsScore +
        experienceScore +
        structureScore;

    return {
        totalScore,
        breakdown: {
            skills: skillsScore,
            projects: projectsScore,
            experience: experienceScore,
            structure: structureScore
        }
    };
}

// function scoreSkills(skills: Skill[]: number){
//     if(skills.length==0){
//         return 0;
//     }
//     return skills.length = 0*1;
// } 

function scoreSkills(skills: { confidence: number }[]): number {
    if (skills.length === 0) return 0;

    const cappedCount = Math.min(skills.length, 10);
    return Math.round((cappedCount / 10) * 30);
}

function scoreProjects(projects: { confidence: number }[]): number {
    if (projects.length === 0) return 0;

    let score = 0;

    for (const project of projects) {
        score += project.confidence >= 0.75 ? 12 : 8;
    }

    return Math.min(35, score);
}

function scoreExperience(experience: { confidence: number }[]): number {
    if (experience.length === 0) return 0;

    let score = 0;

    for (const exp of experience) {
        score += exp.confidence >= 0.75 ? 15 : 10;
    }

    return Math.min(25, score);
}

function scoreStructure(resume: ResumeSchema): number {
    let score = 0;

    if (resume.skills.length > 0) score += 2;
    if (resume.projects.length > 0) score += 3;
    if (resume.experience.length > 0) score += 3;
    if (resume.education.length > 0) score += 2;

    return score;
}

