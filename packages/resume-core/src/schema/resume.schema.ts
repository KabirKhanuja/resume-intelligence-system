export interface ResumeSchema {
    meta: ResumeMeta;

    skills: Skill[];

    projects: Project[];

    experience: Experience[];

    education: Education[];

    certifications: Certification[];

    achievements: string[];

    rawSections: RawSection[]; // for debugging
}

export interface ResumeMeta {
    resumeId: string;

    studentId?: string;

    batch?: string;
    department?: string;
    graduationYear?: number;

    parsedAt: string;
    schemaVersion: "v1";

    confidence: number; // 0–1 overall parsing confidence
}

export interface Skill {
    name: string;
    category?: SkillCategory;
    confidence: number;
}

export type SkillCategory =
    | "programming"
    | "framework"
    | "tool"
    | "database"
    | "ml"
    | "cloud"
    | "other";

export interface Project {
    title?: string;

    description: string;

    technologies: string[];

    domain?: string;

    durationMonths?: number;

    confidence: number;
}

export interface Experience {
    role?: string;
    company?: string;

    durationMonths?: number;

    description: string;

    technologies: string[];

    confidence: number;
}


export interface Education {
    degree?: string;
    institution?: string;

    startYear?: number;
    endYear?: number;

    score?: string; // string to avoid assumptions

    confidence: number;
}

export interface Certification {
    name: string;
    issuer?: string;
    year?: number;

    confidence: number;
}

export interface RawSection {
    heading: string;
    content: string;
    mappedTo?: CanonicalSection;
    confidence: number;
}

export type CanonicalSection =
    | "skills"
    | "projects"
    | "experience"
    | "education"
    | "certifications"
    | "achievements"
    | "positions"
    | "summary"
    | "interests"
    | "unknown";