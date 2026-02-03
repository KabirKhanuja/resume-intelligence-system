import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const adapter = new PrismaLibSql({ url: databaseUrl });

export const prisma = new PrismaClient({ adapter });