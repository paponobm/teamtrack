'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/PermissionsContext'
import { useToast } from '@/lib/ToastContext'
import { IconEdit, IconPlus, IconTrash, IconGlobe, IconShieldAlert, IconUsers, IconRocket } from '@/components/icons/Icons'

interface PolicyItem { title: string; description: string }
interface JourneyItem { year: string; title: string; description: string }

interface AboutUsContent {
    story_title: string | null
    story_body: string | null
    story_image_url: string | null
    policies: PolicyItem[]
    policies_title: string | null
    policies_icon_url: string | null
    team_title: string | null
    journey: JourneyItem[]
    journey_title: string | null
    banner_tagline: string | null
    banner_image_url: string | null
}

interface TeamMember {
    id: string
    name: string
    designation: string | null
    avatar_url: string | null
    photo_url: string | null
    department: { id: string; name: string } | null
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const emptyContent: AboutUsContent = {
    story_title: '', story_body: '', story_image_url: '',
    policies: [], policies_title: '', policies_icon_url: '', team_title: '', journey: [], journey_title: '',
    banner_tagline: '', banner_image_url: '',
}

// Every section heading shares this bold, orange, larger-than-body style.
const SECTION_TITLE_STYLE: CSSProperties = { fontSize: '1.5rem', fontWeight: 800, color: '#EA580C' }

// A light pastel background + matching accent color per policy card, cycling by index so
// neighboring cards never repeat the same color for a reasonable-sized list.
const POLICY_COLORS = [
    { bg: '#EFF6FF', accent: '#2563EB' },
    { bg: '#F0FDF4', accent: '#16A34A' },
    { bg: '#FDF4FF', accent: '#A21CAF' },
    { bg: '#FFF7ED', accent: '#EA580C' },
    { bg: '#FDF2F8', accent: '#DB2777' },
    { bg: '#F0FDFA', accent: '#0D9488' },
    { bg: '#FEFCE8', accent: '#CA8A04' },
    { bg: '#EEF2FF', accent: '#4F46E5' },
]

// A colored gradient icon badge in front of every section title, so each section reads as its
// own distinct block at a glance instead of just another orange heading in a long scroll.
function SectionIcon({ icon, color }: { icon: ReactElement; color: string }) {
    return (
        <div style={{
            width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 16px ${color}40`,
        }}>
            {icon}
        </div>
    )
}

// Lightweight bold-only markup for policy descriptions: text wrapped in **stars** renders as
// <strong>. Keeps the description a plain string (no HTML to sanitize) while still letting an
// admin bold a phrase from the toolbar button next to the textarea.
function renderFormattedText(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
    ))
}

function getAvatarColor(name: string) {
    const colors = ['#2563EB', '#1D4ED8', '#1E40AF', '#3B82F6', '#60A5FA', '#1E3A5F', '#172554', '#93C5FD']
    return colors[(name || '?').charCodeAt(0) % colors.length]
}

export default function AboutUsPage() {
    const { data: perms } = usePermissions()
    const toast = useToast()
    const isAdmin = !!(perms.is_super || perms.is_admin)

    const [content, setContent] = useState<AboutUsContent>(emptyContent)
    const [team, setTeam] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState<AboutUsContent>(emptyContent)
    const [saving, setSaving] = useState(false)
    const [storyUploading, setStoryUploading] = useState(false)
    const [viewingPolicyIdx, setViewingPolicyIdx] = useState<number | null>(null)
    const [bannerUploading, setBannerUploading] = useState(false)
    const [policyIconUploading, setPolicyIconUploading] = useState(false)
    const [isDraggingTeam, setIsDraggingTeam] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/about-us')
            if (res.ok) {
                const data = await res.json()
                const c: AboutUsContent = {
                    story_title: data.content?.story_title || '',
                    story_body: data.content?.story_body || '',
                    story_image_url: data.content?.story_image_url || '',
                    policies: Array.isArray(data.content?.policies) ? data.content.policies : [],
                    policies_title: data.content?.policies_title || '',
                    policies_icon_url: data.content?.policies_icon_url || '',
                    team_title: data.content?.team_title || '',
                    journey: Array.isArray(data.content?.journey) ? data.content.journey : [],
                    journey_title: data.content?.journey_title || '',
                    banner_tagline: data.content?.banner_tagline || '',
                    banner_image_url: data.content?.banner_image_url || '',
                }
                setContent(c)
                setTeam(data.team || [])
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Team carousel: a requestAnimationFrame loop drives the scroll position (instead of a CSS
    // keyframe animation) so the same position can also be nudged by dragging with the mouse.
    // The member list is rendered twice back-to-back, so wrapping the offset at exactly one
    // copy's width (halfWidth) makes the loop seamless in both directions.
    const teamTrackRef = useRef<HTMLDivElement>(null)
    const teamOffsetRef = useRef(0)
    const teamHalfWidthRef = useRef(0)
    const teamPausedRef = useRef(false)
    const teamDragRef = useRef({ dragging: false, startX: 0, startOffset: 0, moved: false })

    useEffect(() => {
        const track = teamTrackRef.current
        if (!team.length || !track) return
        const halfWidth = track.scrollWidth / 2
        teamHalfWidthRef.current = halfWidth
        const pxPerMs = halfWidth / 65000 // matches the previous 65s-per-loop pace
        let last = performance.now()
        let raf = 0
        const tick = (now: number) => {
            const dt = now - last
            last = now
            if (!teamDragRef.current.dragging && !teamPausedRef.current && halfWidth > 0) {
                let next = teamOffsetRef.current + pxPerMs * dt
                next = ((next % halfWidth) + halfWidth) % halfWidth
                teamOffsetRef.current = next
            }
            track.style.transform = `translateX(${-teamOffsetRef.current}px)`
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [team])

    const handleTeamPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        teamDragRef.current = { dragging: true, startX: e.clientX, startOffset: teamOffsetRef.current, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
        setIsDraggingTeam(true)
    }
    const handleTeamPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = teamDragRef.current
        if (!drag.dragging) return
        const dx = e.clientX - drag.startX
        if (Math.abs(dx) > 3) drag.moved = true
        const halfWidth = teamHalfWidthRef.current
        let next = drag.startOffset - dx
        if (halfWidth > 0) next = ((next % halfWidth) + halfWidth) % halfWidth
        teamOffsetRef.current = next
    }
    const endTeamDrag = () => {
        teamDragRef.current.dragging = false
        setIsDraggingTeam(false)
    }

    const startEditing = () => { setDraft(content); setEditing(true) }
    const cancelEditing = () => { setDraft(content); setEditing(false) }

    // Same upload flow as the employee photo uploader (MemberModal) — POST to the shared
    // /api/upload endpoint under a dedicated 'about-us' bucket, get back a public URL.
    const uploadImage = async (file: File, folder: string): Promise<string | null> => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'about-us')
        fd.append('folder', folder)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (data.url) return data.url
        toast.error(data.error || 'Upload failed')
        return null
    }
    const handleStoryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setStoryUploading(true)
        const url = await uploadImage(file, 'story')
        if (url) setDraft(prev => ({ ...prev, story_image_url: url }))
        setStoryUploading(false)
    }
    const handleBannerImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setBannerUploading(true)
        const url = await uploadImage(file, 'banner')
        if (url) setDraft(prev => ({ ...prev, banner_image_url: url }))
        setBannerUploading(false)
    }
    // One shared icon for every policy card, rather than a separate upload per card.
    const handlePolicyIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setPolicyIconUploading(true)
        const url = await uploadImage(file, 'policy-icons')
        if (url) setDraft(prev => ({ ...prev, policies_icon_url: url }))
        setPolicyIconUploading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/about-us', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                toast.error(e.error || 'Failed to save changes')
                return
            }
            setContent(draft)
            setEditing(false)
            toast.success('About Us page updated')
        } finally {
            setSaving(false)
        }
    }

    const updatePolicy = (idx: number, field: keyof PolicyItem, value: string) => {
        setDraft(prev => ({ ...prev, policies: prev.policies.map((p, i) => i === idx ? { ...p, [field]: value } : p) }))
    }
    // Wraps the currently-selected text in a policy's description textarea with ** markers
    // (rendered as bold by renderFormattedText) and restores the selection afterward so
    // repeated bolding of different phrases doesn't lose the cursor position.
    const policyDescRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
    const applyBoldToPolicyDescription = (idx: number) => {
        const ta = policyDescRefs.current[idx]
        if (!ta) return
        const { selectionStart, selectionEnd, value } = ta
        if (selectionStart === selectionEnd) return
        const newValue = `${value.slice(0, selectionStart)}**${value.slice(selectionStart, selectionEnd)}**${value.slice(selectionEnd)}`
        updatePolicy(idx, 'description', newValue)
        requestAnimationFrame(() => {
            ta.focus()
            ta.setSelectionRange(selectionStart + 2, selectionEnd + 2)
        })
    }
    const addPolicy = () => setDraft(prev => ({ ...prev, policies: [...prev.policies, { title: '', description: '' }] }))
    const removePolicy = (idx: number) => setDraft(prev => ({ ...prev, policies: prev.policies.filter((_, i) => i !== idx) }))
    const movePolicy = (idx: number, dir: -1 | 1) => {
        setDraft(prev => {
            const next = [...prev.policies]
            const target = idx + dir
            if (target < 0 || target >= next.length) return prev
            ;[next[idx], next[target]] = [next[target], next[idx]]
            return { ...prev, policies: next }
        })
    }

    const updateJourney = (idx: number, field: keyof JourneyItem, value: string) => {
        setDraft(prev => ({ ...prev, journey: prev.journey.map((j, i) => i === idx ? { ...j, [field]: value } : j) }))
    }
    const addJourney = () => setDraft(prev => ({ ...prev, journey: [...prev.journey, { year: '', title: '', description: '' }] }))
    const removeJourney = (idx: number) => setDraft(prev => ({ ...prev, journey: prev.journey.filter((_, i) => i !== idx) }))
    const moveJourney = (idx: number, dir: -1 | 1) => {
        setDraft(prev => {
            const next = [...prev.journey]
            const target = idx + dir
            if (target < 0 || target >= next.length) return prev
            ;[next[idx], next[target]] = [next[target], next[idx]]
            return { ...prev, journey: next }
        })
    }

    const c = editing ? draft : content

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <span className="spinner" style={{ width: '32px', height: '32px' }} />
            </div>
        )
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show">
            <motion.div className="page-header" variants={item}>
                <div>
                    <h1 className="page-title">About Us</h1>
                    <p className="page-subtitle">Our story, policies, team, and journey.</p>
                </div>
                {isAdmin && !editing && (
                    <button className="btn btn-primary" onClick={startEditing}>
                        <IconEdit size={16} /> Edit Page
                    </button>
                )}
                {editing && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                )}
            </motion.div>

            {/* Our Story */}
            <motion.div variants={item} style={{ marginTop: '100px', marginBottom: '130px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    {editing ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                                <SectionIcon icon={<IconGlobe size={22} color="#fff" />} color="#EA580C" />
                                <input className="input" value={draft.story_title || ''} onChange={e => setDraft({ ...draft, story_title: e.target.value })}
                                    placeholder="Story title" style={{ ...SECTION_TITLE_STYLE, flex: 1 }} />
                            </div>
                            <textarea className="input" value={draft.story_body || ''} onChange={e => setDraft({ ...draft, story_body: e.target.value })}
                                placeholder="Tell your story..." rows={8} style={{ width: '100%', resize: 'vertical' }} />
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                                <SectionIcon icon={<IconGlobe size={22} color="#fff" />} color="#EA580C" />
                                <h2 style={SECTION_TITLE_STYLE}>{c.story_title || 'Our Story'}</h2>
                            </div>
                            <p style={{ whiteSpace: 'pre-line', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                {c.story_body || 'No story added yet.'}
                            </p>
                        </>
                    )}
                </div>
                {(editing || c.story_image_url) && (
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                        {editing ? (
                            storyUploading ? (
                                <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--color-border-light)', borderRadius: '12px' }}>
                                    <span className="spinner" style={{ width: '24px', height: '24px' }} />
                                </div>
                            ) : draft.story_image_url ? (
                                <div>
                                    <img src={draft.story_image_url} alt="" style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block' }} />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                            Replace
                                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleStoryImageChange} />
                                        </label>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...draft, story_image_url: '' })} style={{ color: '#DC2626' }}>Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', border: '2px dashed var(--color-border-light)', borderRadius: '12px', cursor: 'pointer', gap: '8px', color: 'var(--color-text-tertiary)' }}>
                                    <IconPlus size={20} />
                                    <span style={{ fontSize: '0.8125rem' }}>Upload image</span>
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleStoryImageChange} />
                                </label>
                            )
                        ) : (
                            <img src={c.story_image_url || ''} alt="" style={{ width: '100%', height: 'auto', borderRadius: '16px', display: 'block', boxShadow: '0 16px 36px rgba(0,0,0,0.14)' }} />
                        )}
                    </div>
                )}
            </motion.div>

            {/* Our Policies */}
            <motion.div variants={item} style={{ marginBottom: '130px' }}>
                {editing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <SectionIcon icon={<IconShieldAlert size={22} color="#fff" />} color="#2563EB" />
                        <input className="input" value={draft.policies_title || ''} onChange={e => setDraft({ ...draft, policies_title: e.target.value })}
                            placeholder="Our Policies" style={{ ...SECTION_TITLE_STYLE, flex: 1 }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '60px' }}>
                        <SectionIcon icon={<IconShieldAlert size={22} color="#fff" />} color="#2563EB" />
                        <h2 style={SECTION_TITLE_STYLE}>{c.policies_title || 'Our Policies'}</h2>
                    </div>
                )}
                {editing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        {policyIconUploading ? (
                            <span className="spinner" style={{ width: '18px', height: '18px' }} />
                        ) : draft.policies_icon_url ? (
                            <img src={draft.policies_icon_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : null}
                        <label className="btn btn-secondary btn-sm" style={{ cursor: policyIconUploading ? 'wait' : 'pointer' }}>
                            {draft.policies_icon_url ? 'Replace icon (used on every card)' : 'Upload icon (used on every card)'}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} disabled={policyIconUploading} onChange={handlePolicyIconChange} />
                        </label>
                        {draft.policies_icon_url && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...draft, policies_icon_url: '' })} style={{ color: '#DC2626' }}>Remove</button>
                        )}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                    {c.policies.map((p, idx) => {
                        const pc = POLICY_COLORS[idx % POLICY_COLORS.length]
                        return (
                        <div key={idx} className={editing ? undefined : 'about-us-policy-card'} onClick={() => !editing && setViewingPolicyIdx(idx)} style={{
                            padding: '16px', borderRadius: '14px', border: '1px solid var(--color-border-light)', background: pc.bg,
                            position: 'relative', minWidth: 0, overflow: 'hidden', height: editing ? undefined : '260px', display: 'flex', flexDirection: 'column',
                            cursor: editing ? 'default' : 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}>
                            {/* Header row: two-digit number badge (top-left) + the one shared icon (top-right),
                                uploaded once for all cards from the section header below. */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{
                                    padding: '8px 16px', borderRadius: '10px', background: '#fff', color: pc.accent,
                                    fontSize: '1.375rem', fontWeight: 800, flexShrink: 0,
                                }}>
                                    {String(idx + 1).padStart(2, '0')}
                                </span>
                                {c.policies_icon_url && (
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%', background: '#fff', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    }}>
                                        <img src={c.policies_icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                            </div>
                            {editing ? (
                                <input className="input" value={p.title} onChange={e => updatePolicy(idx, 'title', e.target.value)} placeholder="Policy title"
                                    style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '8px' }} />
                            ) : (
                                <strong style={{ fontSize: '1.0625rem', fontWeight: 800, marginBottom: '6px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{p.title}</strong>
                            )}
                            {editing ? (
                                <>
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => applyBoldToPolicyDescription(idx)}
                                            title="Bold the selected text" style={{
                                                width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--color-border-light)',
                                                background: 'var(--color-bg-primary)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
                                            }}>B</button>
                                    </div>
                                    <textarea ref={el => { policyDescRefs.current[idx] = el }} className="input" value={p.description} onChange={e => updatePolicy(idx, 'description', e.target.value)}
                                        placeholder="Description" rows={2} style={{ width: '100%', fontSize: '0.8125rem', resize: 'vertical' }} />
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => movePolicy(idx, -1)} title="Move up" style={{ padding: '4px', fontSize: '0.75rem' }}>↑</button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => movePolicy(idx, 1)} title="Move down" style={{ padding: '4px', fontSize: '0.75rem' }}>↓</button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => removePolicy(idx)} title="Remove" style={{ padding: '4px', color: '#DC2626' }}><IconTrash size={14} /></button>
                                    </div>
                                </>
                            ) : (
                                <p style={{
                                    fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-line',
                                    overflowWrap: 'anywhere', wordBreak: 'break-word', flex: 1, minHeight: 0,
                                    display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>{renderFormattedText(p.description)}</p>
                            )}
                        </div>
                        )
                    })}
                    {c.policies.length === 0 && !editing && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '20px' }}>No policies added yet.</div>
                    )}
                </div>
                {editing && (
                    <button className="btn btn-secondary btn-sm" onClick={addPolicy} style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconPlus size={14} /> Add Policy
                    </button>
                )}
            </motion.div>

            {/* Our Team — an auto-sliding carousel (right to left) rather than a static grid;
                the member list is duplicated once so the looping animation has no visible seam. */}
            <motion.div variants={item} style={{ marginBottom: '130px' }}>
                {editing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                        <SectionIcon icon={<IconUsers size={22} color="#fff" />} color="#16A34A" />
                        <input className="input" value={draft.team_title || ''} onChange={e => setDraft({ ...draft, team_title: e.target.value })}
                            placeholder="Our Team" style={{ ...SECTION_TITLE_STYLE, flex: 1 }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                        <SectionIcon icon={<IconUsers size={22} color="#fff" />} color="#16A34A" />
                        <h2 style={SECTION_TITLE_STYLE}>{c.team_title || 'Our Team'}</h2>
                    </div>
                )}
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', marginBottom: '100px' }}>Meet the people behind the team.</p>
                {team.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '20px' }}>No active members yet.</div>
                ) : (
                    <div
                        style={{ position: 'relative', overflow: 'hidden', cursor: isDraggingTeam ? 'grabbing' : 'grab' }}
                        onMouseEnter={() => { teamPausedRef.current = true }}
                        onMouseLeave={() => { teamPausedRef.current = false }}
                        onPointerDown={handleTeamPointerDown}
                        onPointerMove={handleTeamPointerMove}
                        onPointerUp={endTeamDrag}
                        onPointerCancel={endTeamDrag}
                    >
                        {/* Fade masks at both edges so the infinite carousel appears to dissolve into
                            the page background instead of cutting members off with a hard edge. */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '80px', zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to right, var(--color-bg-primary), transparent)' }} />
                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to left, var(--color-bg-primary), transparent)' }} />
                        <div ref={teamTrackRef} className="about-us-team-track" style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', width: 'max-content', willChange: 'transform' }}>
                            {[...team, ...team].map((m, i) => {
                                // First member's avatar is the biggest, second is bigger than the
                                // usual size but smaller than the first, third-onward unchanged.
                                const origIdx = i % team.length
                                const size = origIdx === 0 ? 150 : origIdx === 1 ? 125 : 110
                                return (
                                <div key={`${m.id}-${i}`} style={{ textAlign: 'center', width: '160px', flexShrink: 0 }}>
                                    <div className="about-us-team-avatar" style={{
                                        width: `${size}px`, height: `${size}px`, borderRadius: '16px', margin: '0 auto 10px', overflow: 'hidden',
                                        background: getAvatarColor(m.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: `${size / 55}rem`, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', transition: 'transform 0.2s ease',
                                    }}>
                                        {(m.avatar_url || m.photo_url) ? (
                                            <img src={m.avatar_url || m.photo_url || ''} alt="" draggable={false} onDragStart={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (m.name || '?')[0]?.toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>{m.name}</div>
                                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#2563EB' }}>{m.designation || m.department?.name || ''}</div>
                                </div>
                                )
                            })}
                        </div>
                        <style dangerouslySetInnerHTML={{
                            __html: `
                                .about-us-team-avatar:hover { transform: translateY(-4px) scale(1.04); }
                                .about-us-policy-card:hover { transform: translateY(-4px); box-shadow: 0 14px 28px rgba(0,0,0,0.1); }
                                .about-us-journey-circle:hover { transform: scale(1.08); }
                            `
                        }} />
                    </div>
                )}
            </motion.div>

            {/* Our Journey — a horizontal timeline in view mode (colored circle per year, bold
                title/description, arrows flowing left to right); edit mode keeps the simpler
                vertical form since typing into small circles would be unusable. */}
            <motion.div variants={item} style={{ marginBottom: '130px' }}>
                {editing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <SectionIcon icon={<IconRocket size={22} color="#fff" />} color="#DB2777" />
                        <input className="input" value={draft.journey_title || ''} onChange={e => setDraft({ ...draft, journey_title: e.target.value })}
                            placeholder="Our Journey" style={{ ...SECTION_TITLE_STYLE, flex: 1 }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '34px' }}>
                        <SectionIcon icon={<IconRocket size={22} color="#fff" />} color="#DB2777" />
                        <h2 style={SECTION_TITLE_STYLE}>{c.journey_title || 'Our Journey'}</h2>
                    </div>
                )}
                {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {c.journey.map((j, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: idx < c.journey.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                <input className="input" value={j.year} onChange={e => updateJourney(idx, 'year', e.target.value)} placeholder="Year"
                                    style={{ width: '90px', flexShrink: 0, fontWeight: 700, fontSize: '0.8125rem' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <input className="input" value={j.title} onChange={e => updateJourney(idx, 'title', e.target.value)} placeholder="Milestone title"
                                        style={{ width: '100%', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }} />
                                    <textarea className="input" value={j.description} onChange={e => updateJourney(idx, 'description', e.target.value)} placeholder="Description"
                                        rows={2} style={{ width: '100%', fontSize: '0.8125rem', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                    <button className="btn btn-ghost btn-icon" onClick={() => moveJourney(idx, -1)} title="Move up" style={{ padding: '4px', fontSize: '0.75rem' }}>↑</button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => moveJourney(idx, 1)} title="Move down" style={{ padding: '4px', fontSize: '0.75rem' }}>↓</button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => removeJourney(idx)} title="Remove" style={{ padding: '4px', color: '#DC2626' }}><IconTrash size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : c.journey.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '20px' }}>No journey milestones added yet.</div>
                ) : (
                    /* Each milestone gets an equal flex share of the full row width (not a fixed
                       width packed to the left), so 2 items land one-left/one-right, 3 items land
                       start/middle/end, and so on — the row always fills the whole available width. */
                    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                        {c.journey.map((j, idx) => {
                            const jc = POLICY_COLORS[idx % POLICY_COLORS.length]
                            return (
                                <Fragment key={idx}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '0 10px' }}>
                                        <div className="about-us-journey-circle" style={{
                                            width: '64px', height: '64px', borderRadius: '50%', background: jc.accent, color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9375rem', flexShrink: 0,
                                            boxShadow: `0 6px 16px ${jc.accent}55`, transition: 'transform 0.2s ease',
                                        }}>
                                            {j.year}
                                        </div>
                                        <div style={{ fontWeight: 700, marginTop: '12px', fontSize: '0.875rem' }}>{j.title}</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '4px', whiteSpace: 'pre-line', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                            {j.description}
                                        </div>
                                    </div>
                                    {idx < c.journey.length - 1 && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '64px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: jc.accent, lineHeight: 1 }}>→</span>
                                        </div>
                                    )}
                                </Fragment>
                            )
                        })}
                    </div>
                )}
                {editing && (
                    <button className="btn btn-secondary btn-sm" onClick={addJourney} style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconPlus size={14} /> Add Milestone
                    </button>
                )}
            </motion.div>

            {/* Footer Banner */}
            {/* <motion.div className="card" variants={item} style={{
                padding: '40px 24px', textAlign: 'center', borderRadius: '18px', border: 'none',
                boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
                background: c.banner_image_url ? `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url(${c.banner_image_url}) center/cover` : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)',
                color: '#fff',
            }}>
                {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '480px', margin: '0 auto' }}>
                        <input className="input" value={draft.banner_tagline || ''} onChange={e => setDraft({ ...draft, banner_tagline: e.target.value })}
                            placeholder="Banner tagline" style={{ color: '#111' }} />
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                            <label className="btn btn-secondary btn-sm" style={{ cursor: bannerUploading ? 'wait' : 'pointer' }}>
                                {bannerUploading ? 'Uploading...' : draft.banner_image_url ? 'Replace background image' : 'Upload background image'}
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} disabled={bannerUploading} onChange={handleBannerImageChange} />
                            </label>
                            {draft.banner_image_url && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...draft, banner_image_url: '' })} style={{ color: '#DC2626' }}>Remove</button>
                            )}
                        </div>
                    </div>
                ) : (
                    <h2 style={{ fontSize: '1.625rem', fontWeight: 800, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.35)', letterSpacing: '0.01em' }}>{c.banner_tagline || ''}</h2>
                )}
            </motion.div> */}

            {/* Policy detail modal — cards show a clamped preview; clicking one opens the full text. */}
            <AnimatePresence>
                {viewingPolicyIdx !== null && content.policies[viewingPolicyIdx] && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingPolicyIdx(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{content.policies[viewingPolicyIdx].title}</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => setViewingPolicyIdx(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-line', overflowWrap: 'anywhere', wordBreak: 'break-word', margin: 0 }}>
                                    {renderFormattedText(content.policies[viewingPolicyIdx].description)}
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setViewingPolicyIdx(null)}>Close</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
