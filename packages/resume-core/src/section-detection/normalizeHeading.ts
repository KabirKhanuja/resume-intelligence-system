
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
    heading = heading.replace(/^[ivxlcdm]+\s*[.)-]?\s*/i, "");

    // to replace punctuation and separators with spaces
    heading = heading.replace(/[^\w\s]/g, " ");

    // for multiple spaces
    heading = heading.replace(/\s+/g, " ");

    // trimming unnecessary spaces
    heading = heading.trim();

    return heading;
}