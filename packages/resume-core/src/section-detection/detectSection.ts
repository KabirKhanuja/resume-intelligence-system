import { SECTION_ALIASES } from "./aliases.js";
import { normalizeHeading } from "./normalizeHeading.js";
import type { RawSection, CanonicalSection } from "../schema/resume.schema.js";

export function detectSections(resumeText: string): RawSection[] {
    const lines = resumeText.split(/\r?\n/).map(l => l.trim());

    const sections: RawSection[] = [];
    let currentSection: RawSection | null = null;

    for (const line of lines) {
        if (!line) continue;

        const normalized = normalizeHeading(line);
        const sectionMatch = matchSection(normalized);

        if (sectionMatch) {
            if (currentSection) {
                sections.push(currentSection);
            }

            currentSection = {
                heading: line,
                content: "",
                mappedTo: sectionMatch.section,
                confidence: sectionMatch.confidence
            };
        } else {
            if (!currentSection) {
                currentSection = {
                    heading: "unknown",
                    content: "",
                    mappedTo: "unknown",
                    confidence: 0.3
                };
            }

            currentSection.content += line + "\n";
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

function matchSection(
    normalizedHeading: string
): { section: CanonicalSection; confidence: number } | null {
    for (const [section, aliases] of Object.entries(SECTION_ALIASES) as [
        CanonicalSection,
        string[]
    ][]) {
        for (const alias of aliases) {
            if (normalizedHeading === alias) {
                return { section, confidence: 0.95 };
            }

            if (
                normalizedHeading.includes(alias) &&
                Math.abs(normalizedHeading.length - alias.length) <= 10
            ) {
                return { section, confidence: 0.75 };
            }
        }
    }

    return null;
}