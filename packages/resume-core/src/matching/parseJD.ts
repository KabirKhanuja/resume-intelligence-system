const JD_SKILLS = [
  "python", "java", "c++", "javascript", "typescript",
  "react", "node.js", "express",
  "sql", "mysql", "postgresql", "mongodb",
  "machine learning", "deep learning",
  "docker", "aws"
];

export interface ParsedJD {
  skills: string[];
}

export function parseJD(jdText: string): ParsedJD {
  const text = jdText.toLowerCase();

  const skills = JD_SKILLS.filter(skill =>
    text.includes(skill)
  );

  return {
    skills
  };
}