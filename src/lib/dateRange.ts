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
