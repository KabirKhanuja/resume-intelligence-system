import { detectSections } from "./section-detection/detectSection.js";
import { extractSkills } from "./extraction/skills.extractor.js";
import { extractProjects } from "./extraction/projects.extractor.js";
import { extractExperience } from "./extraction/experience.extractor.js";

import type {
    ResumeSchema,
    ResumeMeta
} from "./schema/resume.schema.js";

export function buildResumeSchema(
    rawText: string,
    meta?: Partial<ResumeMeta>
): ResumeSchema {
    const parsedAt = new Date().toISOString();

    const rawSections = detectSections(rawText);
    const skills = extractSkills(rawSections);
    const projects = extractProjects(rawSections);
    const experience = extractExperience(rawSections);

    const confidence =
        rawSections.length === 0
            ? 0
            : rawSections.reduce((sum, s) => sum + s.confidence, 0) /
            rawSections.length;

    const baseMeta: ResumeMeta = {
        resumeId: meta?.resumeId ?? crypto.randomUUID(),
        parsedAt,
        schemaVersion: "v1",
        confidence
    };

    const fullMeta: ResumeMeta = {
        ...baseMeta,
        ...(meta?.studentId && { studentId: meta.studentId }),
        ...(meta?.batch && { batch: meta.batch }),
        ...(meta?.department && { department: meta.department }),
        ...(meta?.graduationYear && { graduationYear: meta.graduationYear })
    };

    return {
        meta: fullMeta,

        skills,
        projects,
        experience,
        education: [],
        certifications: [],
        achievements: [],
        rawSections
    };
}