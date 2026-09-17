// Small tag shown next to a deactivated employee's name wherever their historical records still
// appear (Payroll, Attendance, Work Log) — the record itself is never deleted just because the
// employee later left, so this makes it obvious at a glance that the name belongs to someone no
// longer active, without needing to open Members to check.
export default function OutBadge() {
    return (
        <span style={{
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '0.625rem',
            fontWeight: 700,
            color: '#EA580C',
            background: 'rgba(234,88,12,0.15)',
            letterSpacing: '0.02em',
            flexShrink: 0,
        }}>
            OUT
        </span>
    )
}
