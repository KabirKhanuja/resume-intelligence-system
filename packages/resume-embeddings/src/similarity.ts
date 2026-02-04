export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vectors must have the same length (got ${a.length} and ${b.length}).`);
  }

  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;

    dot += ai * bi;
    normA += ai ** 2;
    normB += bi ** 2;
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}