import { getMonthRangeFromString } from './dateRange'
import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

// Product Buy is intentionally NOT mirrored into Finance Hub Expenses (unlike Advance/EMI) —
// it may be wired into an Income flow instead later, so no expense-linking helpers live here.

export interface ProductBuyRecord {
    date: string
    amount: number
}

export interface EmployeeProductBuyDetail {
    total: number
    records: ProductBuyRecord[]
}

// Live-computed monthly total + breakdown for the Salary Sheet's separate "Product Buy"
// column — same "reuse, don't duplicate" pattern as getAdvanceDetailsForMonth in
// src/lib/payroll.ts, just sourced from product_buys instead of advances.
export async function getProductBuyDetailsForMonth(db: Db, employeeIds: string[], month: string): Promise<Record<string, EmployeeProductBuyDetail>> {
    const { start, end } = getMonthRangeFromString(month)
    const details: Record<string, EmployeeProductBuyDetail> = {}
    employeeIds.forEach(id => { details[id] = { total: 0, records: [] } })
    if (employeeIds.length === 0) return details

    const { rows } = await db.query(
        `SELECT employee_id, amount, purchase_date FROM product_buys
         WHERE employee_id = ANY($1) AND purchase_date >= $2 AND purchase_date <= $3
         ORDER BY purchase_date ASC`,
        [employeeIds, start, end]
    )

    rows.forEach((r: { employee_id: string; amount: number; purchase_date: string }) => {
        const d = details[r.employee_id]
        if (!d) return
        const amount = Number(r.amount) || 0
        d.total += amount
        d.records.push({ date: r.purchase_date, amount })
    })
    return details
}
