
// this maps all canonical resume sections to all commonly observed human written headings


import type { CanonicalSection } from "../schema/resume.schema.js";

export const SECTION_ALIASES: Record<CanonicalSection, string[]> = {
    skills: [
        "skills",
        "technical skills",
        "key skills",
        "core skills",
        "core competencies",
        "technical competencies",
        "technologies",
        "tools",
        "tools and technologies",
        "software skills",
        "programming skills",
        "areas of expertise",
        "expertise"
    ],

    projects: [
        "projects",
        "project",
        "academic projects",
        "personal projects",
        "key projects",
        "major projects",
        "minor projects",
        "selected projects",
        "notable projects",
        "engineering projects",
        "college projects",
        "what i built",
        "what i have built",
        "my work",
        "work samples",
        "practical work",
        "hands on projects",
        "hands on experience",
        "capstone project",
        "capstone projects"
    ],

    experience: [
        "experience",
        "work experience",
        "professional experience",
        "industry experience",
        "internship",
        "internships",
        "industrial training",
        "training",
        "employment",
        "work history",
        "job experience",
        "corporate experience",
        "professional background",
        "career experience"
    ],

    education: [
        "education",
        "educational background",
        "academic background",
        "academics",
        "academic qualifications",
        "educational qualifications",
        "education details",
        "academic details",
        "qualification",
        "qualifications",
        "degrees",
        "degree"
    ],

    certifications: [
        "certifications",
        "certification",
        "certificates",
        "certificate",
        "courses",
        "online courses",
        "professional courses",
        "completed courses",
        "licenses",
        "training and certification",
        "training courses"
    ],

    achievements: [
        "achievements",
        "awards",
        "honors",
        "honours",
        "recognition",
        "accomplishments",
        "merits",
        "distinctions",
        "scholarships",
        "competitive achievements"
    ],

    positions: [
        "positions of responsibility",
        "por",
        "leadership",
        "leadership experience",
        "responsibilities",
        "roles and responsibilities",
        "extra responsibilities",
        "positions held",
        "organizational roles",
        "committee roles"
    ],

    summary: [
        "summary",
        "profile",
        "professional summary",
        "career summary",
        "about me",
        "objective",
        "career objective",
        "resume objective",
        "personal statement",
        "introduction"
    ],

    interests: [
        "interests",
        "hobbies",
        "hobbies and interests",
        "extracurricular activities",
        "extra curricular activities",
        "activities",
        "co curricular activities",
        "personal interests"
    ],

    unknown: []
};