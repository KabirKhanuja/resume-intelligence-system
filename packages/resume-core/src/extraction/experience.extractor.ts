import type { RawSection } from "../schema/resume.schema.js";
import type { Experience } from "../schema/resume.schema.js";

const TECH_KEYWORDS = [
    "python", "java", "c++", "javascript", "typescript",
    "react", "next.js", "node.js", "express",
    "mysql", "postgresql", "mongodb",
    "docker", "aws", "linux"
];

const ROLE_KEYWORDS = [
    "intern",
    "developer",
    "engineer",
    "software",
    "backend",
    "frontend",
    "full stack",
    "research",
    "analyst"
];

export function extractExperience(sections: RawSection[]): Experience[] {
    const experiences: Experience[] = [];

    const experienceSections = sections.filter(
        s => s.mappedTo === "experience" && s.content.trim().length > 0
    );

    for (const section of experienceSections) {
        const blocks = splitIntoExperienceBlocks(section.content);

        for (const block of blocks) {
            const description = block.trim();
            if (description.length < 40) continue;

            const text = description.toLowerCase();

            const technologies = TECH_KEYWORDS.filter(t =>
                text.includes(t)
            );

            const role = detectRole(text);

            const confidence = computeConfidence({
                hasRole: Boolean(role),
                hasTech: technologies.length > 0,
                sectionConfidence: section.confidence,
                length: description.length
            });

            experiences.push({
                ...(role && { role }),
                description,
                technologies,
                confidence
            });
        }
    }

    return experiences;
}

function splitIntoExperienceBlocks(content: string): string[] {
    return content
        .split(/\n\s*\n|•|- |\d+\.\s+/)
        .map(b => b.trim())
        .filter(Boolean);
}

function detectRole(text: string): string | undefined {
    for (const role of ROLE_KEYWORDS) {
        if (text.includes(role)) {
            return role;
        }
    }
    return undefined;
}

function computeConfidence(params: {
    hasRole: boolean;
    hasTech: boolean;
    sectionConfidence: number;
    length: number;
}): number {
    let score = params.sectionConfidence * 0.6;

    if (params.hasRole) score += 0.2;
    if (params.hasTech) score += 0.15;
    if (params.length > 150) score += 0.05;

    return Math.min(1, score);
}

