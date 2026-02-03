import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiSrcDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(apiSrcDir, "../prisma/dev.db");
const url = process.env.DATABASE_URL ?? `file:${defaultDbPath}`;

const adapter = new PrismaLibSql({ url });

export const prisma = new PrismaClient({
  adapter,
});