// One-time backfill for ADR 0006: populate TrainingReport.acwrStatus and
// .weeklyTotalLoad from the already-stored metrics.loadProfile.
//
// Idempotent: re-derives from metrics (the source of truth) every run, so it is
// safe to run repeatedly and safe to run after new reports have been written.
//
// Target DB: uses process.env.DATABASE_URL if set, otherwise reads DATABASE_URL
// from the local .env (the dev DB). To run against PROD, pass the prod URL
// explicitly and rehearse with --dry-run first:
//
//   DATABASE_URL="<prod-url>" node prisma/backfill-report-load-columns.mjs --dry-run
//   DATABASE_URL="<prod-url>" node prisma/backfill-report-load-columns.mjs
//
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const dryRun = process.argv.includes('--dry-run');

function resolveDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const here = dirname(fileURLToPath(import.meta.url));
    const envText = readFileSync(join(here, '..', '.env'), 'utf8');
    const match = envText.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (!match) throw new Error('DATABASE_URL not found in .env and not set in the environment');
    return match[1];
}

function redactHost(url) {
    const m = url.match(/@([^/:?]+)/);
    return m ? m[1] : '(unknown host)';
}

const url = resolveDatabaseUrl();
console.log(`Target DB host: ${redactHost(url)}${dryRun ? '  [DRY RUN]' : ''}`);

const prisma = new PrismaClient({ datasources: { db: { url } } });

let scanned = 0;
let updated = 0;
let skippedNoProfile = 0;
let alreadyCorrect = 0;

try {
    const reports = await prisma.trainingReport.findMany({
        select: { id: true, metrics: true, acwrStatus: true, weeklyTotalLoad: true, monotonyIsHigh: true },
    });

    for (const report of reports) {
        scanned += 1;
        const loadProfile = report.metrics?.loadProfile;
        const status = loadProfile?.acwrStatus ?? null;
        const load = typeof loadProfile?.weeklyTotalLoad === 'number' ? loadProfile.weeklyTotalLoad : null;
        const monotonyIsHigh = typeof loadProfile?.monotonyIsHigh === 'boolean' ? loadProfile.monotonyIsHigh : null;

        // No load profile in this report's metrics: leave columns null (nullable by design).
        if (status === null && load === null && monotonyIsHigh === null) {
            skippedNoProfile += 1;
            continue;
        }

        // Already matches — nothing to write. Keeps re-runs quiet and cheap.
        if (
            report.acwrStatus === status &&
            report.weeklyTotalLoad === load &&
            report.monotonyIsHigh === monotonyIsHigh
        ) {
            alreadyCorrect += 1;
            continue;
        }

        if (!dryRun) {
            await prisma.trainingReport.update({
                where: { id: report.id },
                data: { acwrStatus: status, weeklyTotalLoad: load, monotonyIsHigh },
            });
        }
        updated += 1;
    }

    console.log(
        `Scanned ${scanned} | ${dryRun ? 'would update' : 'updated'} ${updated} | ` +
            `already correct ${alreadyCorrect} | no load profile ${skippedNoProfile}`,
    );
} finally {
    await prisma.$disconnect();
}
