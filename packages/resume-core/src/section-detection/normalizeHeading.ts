
//  this will normalize a resume section heading into a comparable string

export function normalizeHeading(rawHeading: string): string {
    if (!rawHeading) return "";

    let heading = rawHeading;

    // to lowercase
    heading = heading.toLowerCase();

    // to remove common bullet characters
    heading = heading.replace(/^[\s•\-–—*]+/, "");

    // to remove leading numbering 
    heading = heading.replace(/^[\d]+\s*[.)-]?\s*/, "");

    // Remove leading roman numerals only when they look like a standalone prefix
    // (e.g. "IV. Education", "I) Skills", "II - Projects").
    // Do NOT strip when the text is a normal word starting with "i" (e.g. "Internships").
    heading = heading.replace(/^[ivxlcdm]+\s*[.)-]\s*/i, "");
    heading = heading.replace(/^[ivxlcdm]+\s+(?=\w)/i, "");

    // to replace punctuation and separators with spaces
    heading = heading.replace(/[^\w\s]/g, " ");

    // for multiple spaces
    heading = heading.replace(/\s+/g, " ");

    // trimming unnecessary spaces
    heading = heading.trim();

    return heading;
}