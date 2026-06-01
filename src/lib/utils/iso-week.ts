const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ms)) return false;
    return formatUTCDate(new Date(ms)) === value;
}

export function isMonday(yyyymmdd: string): boolean {
    if (!isValidDateString(yyyymmdd)) return false;
    return new Date(`${yyyymmdd}T00:00:00Z`).getUTCDay() === 1;
}

export function isSunday(yyyymmdd: string): boolean {
    if (!isValidDateString(yyyymmdd)) return false;
    return new Date(`${yyyymmdd}T00:00:00Z`).getUTCDay() === 0;
}

export function addDays(yyyymmdd: string, n: number): string {
    if (!isValidDateString(yyyymmdd)) {
        throw new Error(`Invalid date string: ${yyyymmdd}`);
    }
    const d = new Date(`${yyyymmdd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return formatUTCDate(d);
}

export function daysBetween(from: string, to: string): number {
    if (!isValidDateString(from) || !isValidDateString(to)) {
        throw new Error(`Invalid date string in daysBetween(${from}, ${to})`);
    }
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to}T00:00:00Z`);
    return Math.round((toMs - fromMs) / 86_400_000);
}

export function todayInTimezone(timezone: string = 'UTC'): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}

export function isFutureDate(yyyymmdd: string, timezone: string = 'UTC'): boolean {
    if (!isValidDateString(yyyymmdd)) return false;
    return yyyymmdd > todayInTimezone(timezone);
}

export function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export function currentMonthStartIso(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

function formatUTCDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
