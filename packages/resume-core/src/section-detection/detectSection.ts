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
        const sectionMatch = matchSection(normalized, line);

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

            // If the heading line also contains content (common in PDF extraction),
            // keep the remainder as the first line of the section content.
            if (sectionMatch.remainder) {
                currentSection.content += sectionMatch.remainder + "\n";
            }
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
    normalizedHeading: string,
    rawHeading: string
): { section: CanonicalSection; confidence: number; remainder?: string } | null {
    // Heuristic: some PDFs merge the section title with the first entry on the same line.
    // The most damaging case for scoring is "Internships ..." not being mapped to experience.
    if (normalizedHeading === "internship" || normalizedHeading === "internships" || normalizedHeading.startsWith("internship ") || normalizedHeading.startsWith("internships ")) {
        const remainder = stripHeadingPrefix(rawHeading, "internships") ?? stripHeadingPrefix(rawHeading, "internship") ?? "";
        return { section: "experience", confidence: 0.8, ...(remainder && { remainder }) };
    }

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

function stripHeadingPrefix(rawLine: string, normalizedAlias: string): string | null {
    const aliasWords = normalizedAlias.split(/\s+/).filter(Boolean);
    if (aliasWords.length === 0) return null;

    // Match the alias words at the beginning of the line, allowing punctuation/separators between.
    // Example: "Internships | Summer Internship ..." or "Internships: Summer ..."
    const pattern =
        "^\\s*[•\\-–—*]*\\s*" +
        aliasWords.map(escapeRegExp).join("[\\s\\W_]+") +
        "(?:[\\s\\W_]+|$)";

    const re = new RegExp(pattern, "i");
    if (!re.test(rawLine)) return null;

    const remainder = rawLine.replace(re, "").trim();
    return remainder || null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}