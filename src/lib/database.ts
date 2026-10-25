import { PrismaClient } from '@prisma/client';

// Vite re-runs this module on every hot reload; reusing one client keeps old pools from holding
// pooler connections until the limit is reached.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
