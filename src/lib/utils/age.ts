export function ageFromBirthDate(birthDate: Date, asOf: Date = new Date()): number {
    let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = asOf.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birthDate.getUTCDate())) {
        age -= 1;
    }
    return age;
}
