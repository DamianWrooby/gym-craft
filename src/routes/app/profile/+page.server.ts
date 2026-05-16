import { error } from '@sveltejs/kit';
import { to } from 'await-to-js';
import { getAthleteProfile, getRunningGoals } from '$lib/prisma/prisma';

export async function load({ locals }) {
    const userId = locals.user?.id;
    if (!userId) throw error(401, 'Unauthorized');

    const [err, results] = await to(
        Promise.all([getAthleteProfile(userId), getRunningGoals(userId, { includeArchived: false })]),
    );
    if (err || !results) throw error(500, 'Cannot load profile');
    const [profile, goals] = results;

    return {
        profile: profile
            ? {
                  ...profile,
                  birthDate: profile.birthDate.toISOString().slice(0, 10),
                  weightKg: Number(profile.weightKg),
                  vo2max: profile.vo2max != null ? Number(profile.vo2max) : null,
                  updatedAt: profile.updatedAt.toISOString(),
              }
            : null,
        goals: goals.map((g) => ({
            ...g,
            targetEventDate: g.targetEventDate?.toISOString().slice(0, 10) ?? null,
            archivedAt: g.archivedAt?.toISOString() ?? null,
            createdAt: g.createdAt.toISOString(),
            updatedAt: g.updatedAt.toISOString(),
        })),
    };
}
