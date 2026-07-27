-- 028 (OPTIONAL) — Re-enable extra status/priority values that the UI used to offer.
--
-- Context: the live database's CHECK constraints reject:
--   * work_entries.delivery_status = 'confirmed'
--   * notices.priority             = 'emergency'
-- Both values were present in the UI but caused silent 500s on save, so they were
-- removed from the frontend (default delivery status is now 'pending'; notice
-- priorities are normal/important/urgent).
--
-- Run this migration ONLY if you want those two extra values back. After applying it,
-- re-add the corresponding <option> entries in:
--   * src/components/work-log/WorkEntryModal.tsx and src/app/(dashboard)/work-log/page.tsx  (delivery_status 'confirmed')
--   * src/app/(dashboard)/noticeboard/page.tsx                                               (priority 'emergency')

-- --- work_entries.delivery_status: add 'confirmed' ---
ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_delivery_status_check;
ALTER TABLE work_entries ADD CONSTRAINT work_entries_delivery_status_check
    CHECK (delivery_status IN (
        'confirmed', 'pending', 'delivered', 'returned', 'exchanged',
        'refunded', 'partial_refunded', 'cancelled', 'partial'
    ));

-- --- notices.priority: add 'emergency' ---
ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_priority_check;
ALTER TABLE notices ADD CONSTRAINT notices_priority_check
    CHECK (priority IN ('normal', 'important', 'urgent', 'emergency'));

-- --- attendance.status: add 'on_duty' ---
-- The attendance UI offered an "On Duty" status but the live CHECK rejects it, so marking
-- someone On Duty silently failed. It was removed from the UI; run this to bring it back.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
    CHECK (status IN ('present', 'late', 'absent', 'leave', 'half_day', 'on_duty'));
