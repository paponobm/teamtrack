// Shared display formatting helpers.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** English ordinal suffix for a day-of-month (1 -> "st", 2 -> "nd", 11 -> "th", 22 -> "nd"). */
export function ordinal(n: number): string {
    const v = n % 100
    if (v >= 11 && v <= 13) return `${n}th`
    switch (n % 10) {
        case 1: return `${n}st`
        case 2: return `${n}nd`
        case 3: return `${n}rd`
        default: return `${n}th`
    }
}

/**
 * Format a date as "12th June, Friday, 2026" (ordinal day + month + weekday + year).
 * Accepts a YYYY-MM-DD string (parsed at local midnight to avoid UTC day-shift) or a Date.
 */
export function formatLongDate(input: string | Date): string {
    const d = typeof input === 'string'
        ? new Date(input.length === 10 ? input + 'T00:00:00' : input)
        : input
    if (isNaN(d.getTime())) return typeof input === 'string' ? input : ''
    return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}, ${d.getFullYear()}`
}
