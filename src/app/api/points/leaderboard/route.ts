import { requireAuth, isAuthed } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const auth = await requireAuth(0)
    if (!isAuthed(auth)) return auth
    const db = auth.db

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (startDate && endDate) {
        // Aggregate points from point_transactions for the specific date range
        const { rows: txs } = await db.query(
            `SELECT employee_id, points FROM point_transactions WHERE created_at >= $1 AND created_at <= $2`,
            [startDate + 'T00:00:00.000Z', endDate + 'T23:59:59.999Z']
        )

        // Get employees
        const { rows: emps } = await db.query(
            `SELECT id, name, avatar_url, designation, is_active FROM employees WHERE is_active = true`
        )

        // Calculate points
        const pointsMap: Record<string, number> = {}
        txs.forEach(tx => {
            pointsMap[tx.employee_id] = (pointsMap[tx.employee_id] || 0) + tx.points
        })

        const leaderboard = emps.map(emp => ({
            ...emp,
            total_points: pointsMap[emp.id] || 0
        })).sort((a, b) => b.total_points - a.total_points)

        return NextResponse.json({ leaderboard })
    }

    // Default behavior without dates
    const { rows } = await db.query(
        `SELECT id, name, avatar_url, total_points, designation, is_active FROM employees WHERE is_active = true ORDER BY total_points DESC`
    )

    return NextResponse.json({ leaderboard: rows })
}
