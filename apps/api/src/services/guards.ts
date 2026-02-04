import type { Prisma } from "@prisma/client";
import type { ResumeSchema } from "resume-core";

export function toResumeSchema(value: Prisma.JsonValue): ResumeSchema | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ResumeSchema>;
  if (!candidate.meta || typeof candidate.meta !== "object") return null;
  if (typeof (candidate.meta as any).resumeId !== "string") return null;
  return value as unknown as ResumeSchema;
}

export function toEmbedding(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  return value as number[];
}
