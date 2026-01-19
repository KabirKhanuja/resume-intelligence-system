import type { RawSection } from "../schema/resume.schema.js";
import type { Project } from "../schema/resume.schema.js";

const TECH_KEYWORDS = [
    "python", "java", "c++", "javascript", "typescript",
    "react", "next.js", "node.js", "express",
    "mysql", "postgresql", "mongodb",
    "machine learning", "deep learning", "nlp",
    "docker", "aws", "linux"
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    web: ["react", "next", "frontend", "backend", "web"],
    ml: ["machine learning", "ml", "deep learning", "model"],
    systems: ["os", "kernel", "system"],
    data: ["data", "analysis", "pipeline"]
};

export function extractProjects(sections: RawSection[]): Project[] {
    const projects: Project[] = [];

    const projectSections = sections.filter(
        s => s.mappedTo === "projects" && s.content.trim().length > 0
    );

    for (const section of projectSections) {
        const blocks = splitIntoProjectBlocks(section.content);

        for (const block of blocks) {
            const description = block.trim();
            if (description.length < 30) continue;

            const text = description.toLowerCase();

            const technologies = TECH_KEYWORDS.filter(t =>
                text.includes(t)
            );

            const domain = detectDomain(text);

            const confidence = computeConfidence({
                hasTech: technologies.length > 0,
                sectionConfidence: section.confidence,
                length: description.length
            });

            projects.push({
                description,
                technologies,
                ...(domain && { domain }),
                confidence
            });
        }
    }

    return projects;
}

function splitIntoProjectBlocks(content: string): string[] {
    return content
        .split(/\n\s*\n|•|- |\d+\.\s+/)
        .map(b => b.trim())
        .filter(Boolean);
}

function detectDomain(text: string): string | undefined {
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) {
            return domain;
        }
    }
    return undefined;
}

function computeConfidence(params: {
    hasTech: boolean;
    sectionConfidence: number;
    length: number;
}): number {
    let score = params.sectionConfidence * 0.6;

    if (params.hasTech) score += 0.25;
    if (params.length > 120) score += 0.15;

    return Math.min(1, score);
}