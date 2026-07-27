const startDate = "2026-05-30"
const endDate = "2026-05-30"
const start = new Date(startDate)
const end = new Date(endDate)

const diffTime = Math.abs(end.getTime() - start.getTime())
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
console.log(diffDays)

const dates = []
for (let i = 0; i < diffDays; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
}
console.log(dates)
