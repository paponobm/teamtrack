// Shared Daily/Weekly/Monthly/Custom date-range helpers.

export function getLocalDateString(d: Date = new Date()): string {
    const local = new Date(d)
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
    return local.toISOString().split('T')[0]
}

export function getWeekRange(date: Date) {
    const day = date.getDay()
    const start = new Date(date)
    start.setDate(date.getDate() - (day === 0 ? 6 : day - 1)) // Monday
    const end = new Date(start)
    end.setDate(start.getDate() + 6) // Sunday
    return { start: getLocalDateString(start), end: getLocalDateString(end) }
}

export function getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return { start: getLocalDateString(start), end: getLocalDateString(end) }
}

// Same as getMonthRange, but takes a 'YYYY-MM' string (the shape <input type="month">
// and the payroll module's `salary_sheets.month` column both use) instead of a Date.
export function getMonthRangeFromString(month: string) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { start: getLocalDateString(start), end: getLocalDateString(end) }
}

// Actual calendar day count for a 'YYYY-MM' month (28-31) — used for counting how many
// Present/Leave/Absent days a month actually has (e.g. payroll's required-working-days math
// in src/lib/payroll.ts), as opposed to STANDARD_MONTH_DAYS there, which is a fixed 30 used
// only for the per-day salary RATE so it doesn't fluctuate between a 28-day February and a
// 31-day August.
export function daysInMonthFromString(month: string): number {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
}
