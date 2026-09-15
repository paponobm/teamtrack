import type { Pool, PoolClient } from 'pg'

// Auto-marks an employee 'absent' once more than 2 hours have passed since their duty_start_time
// with no clock-in and no existing attendance row for that day — e.g. reporting time 10:00 AM,
// still no attendance record by 12:00 PM, so they're absent. Previously this rule only existed
// as a read-only computation for the Noticeboard's "Absent Today" widget (GET /api/attendance/
// absent) and was never written to the database, so an employee who simply never showed up left
// no trace: the Daily Attendance list wouldn't list them, and the monthly report's aggregate
// (which only counts rows that already exist) would silently undercount their absences.
//
// Requires BOTH duty_start_time and duty_end_time to actually be configured (Members → Edit
// Member → Duty Schedule) — an employee whose schedule was never set up has no real "reporting
// time" to be late/absent against, so silently defaulting them to 09:00 AM (the old behavior)
// wrongly auto-marked them absent every single day. Those employees are excluded from Daily
// Attendance and Attendance Report entirely (see the matching e.duty_start_time IS NOT NULL /
// e.duty_end_time IS NOT NULL filters in src/app/api/attendance/route.ts and
// src/app/api/attendance/report/route.ts) until their schedule is actually set.
//
// Called at the top of every admin attendance read (daily list + monthly report) so the missing
// row gets created lazily the first time anyone looks, with no cron/scheduler required. Safe to
// call repeatedly — ON CONFLICT (employee_id, date) means it never touches a day that already
// has a record (present/late/leave/absent/whatever an admin or the employee already set).
export async function backfillAbsences(db: Pool | PoolClient, startDate: string, endDate: string) {
    await db.query(
        `INSERT INTO attendance (employee_id, date, status)
         SELECT e.id, gs.d::date, 'absent'
         FROM employees e
         CROSS JOIN generate_series($1::date, LEAST($2::date, (NOW() AT TIME ZONE 'Asia/Dhaka')::date), interval '1 day') AS gs(d)
         LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = gs.d::date
         WHERE e.is_active = true
           AND e.duty_start_time IS NOT NULL
           AND e.duty_end_time IS NOT NULL
           AND a.id IS NULL
           AND (
             gs.d::date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date
             OR (
               gs.d::date = (NOW() AT TIME ZONE 'Asia/Dhaka')::date
               AND NOW() > ((gs.d::date::text || ' ' || e.duty_start_time)::timestamp AT TIME ZONE 'Asia/Dhaka') + interval '2 hours'
             )
           )
         ON CONFLICT (employee_id, date) DO NOTHING`,
        [startDate, endDate]
    )
}
