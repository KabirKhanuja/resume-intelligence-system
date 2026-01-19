import type { RawSection } from "../schema/resume.schema.ts";
import type { Skill } from "../schema/resume.schema.ts";


const KNOWN_SKILLS = new Set([
    // programming
    "python", "java", "c", "c++", "javascript", "typescript",

    // web
    "html", "css", "react", "next.js", "node.js", "express",

    // databases
    "mysql", "postgresql", "mongodb", "sqlite",

    // ml / ai
    "machine learning", "deep learning", "nlp", "computer vision",

    // tools
    "git", "github", "docker", "linux",

    // cloud
    "aws", "azure", "gcp"
]);

export function extractSkills(sections: RawSection[]): Skill[] {
    const skillMap = new Map<string, Skill>();

    for (const section of sections) {
        const sourceWeight = sectionSourceWeight(section.mappedTo);
        const text = section.content.toLowerCase();

        for (const skill of KNOWN_SKILLS) {
            if (text.includes(skill)) {
                const confidence = Math.min(
                    1,
                    0.5 + sourceWeight * section.confidence
                );

                const existing = skillMap.get(skill);
                if (!existing || existing.confidence < confidence) {
                    skillMap.set(skill, {
                        name: skill,
                        confidence
                    });
                }
            }
        }
    }

    return Array.from(skillMap.values());
}

function sectionSourceWeight(section?: string): number {
    switch (section) {
        case "skills":
            return 0.6;
        case "projects":
            return 0.9;
        case "experience":
            return 0.8;
        default:
            return 0.4;
    }
}