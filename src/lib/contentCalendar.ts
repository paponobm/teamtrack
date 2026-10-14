// Content Calendar — shared, DB-free constants and pure helpers. Mirrors the pipeline rules
// from the reference artifact (STAGE/KINDS there): which stages a post format goes through,
// what each stage is called, and which content-role gets auto-assigned to it. Kept here (not
// duplicated per-route) so the Month/Board/Workload views and the API agree on one definition.

export type Stage = 'plan' | 'idea' | 'collect' | 'script' | 'shoot' | 'prep' | 'design' | 'edit' | 'thumb' | 'review' | 'ready'
export type Kind = 'video' | 'photo' | 'design' | 'text' | 'live'
export type ContentRole = 'plan' | 'script' | 'shoot' | 'design' | 'edit' | 'live' | 'post'

export const CONTENT_ROLES: { key: ContentRole; label: string }[] = [
    { key: 'plan', label: 'প্ল্যান ও অনুমোদন' },
    { key: 'script', label: 'স্ক্রিপ্ট' },
    { key: 'shoot', label: 'শুট' },
    { key: 'design', label: 'ডিজাইন' },
    { key: 'edit', label: 'ভিডিও এডিট' },
    { key: 'live', label: 'লাইভ' },
    { key: 'post', label: 'পোস্ট করা' },
]

// Stage name + which content role is auto-assigned when an item enters it.
export const STAGE_INFO: Record<Stage, { label: string; role: ContentRole }> = {
    plan: { label: 'প্ল্যান', role: 'plan' },
    idea: { label: 'আইডিয়া', role: 'plan' },
    collect: { label: 'রিভিউ সংগ্রহ', role: 'plan' },
    script: { label: 'স্ক্রিপ্ট', role: 'script' },
    shoot: { label: 'শুট', role: 'shoot' },
    prep: { label: 'প্রোডাক্ট সাজানো', role: 'live' },
    design: { label: 'ডিজাইন', role: 'design' },
    edit: { label: 'এডিট', role: 'edit' },
    thumb: { label: 'থাম্বনেইল', role: 'design' },
    review: { label: 'অনুমোদন', role: 'plan' },
    ready: { label: 'পোস্টের জন্য প্রস্তুত', role: 'post' },
}

export const STAGE_ORDER: Stage[] = ['plan', 'idea', 'collect', 'script', 'shoot', 'prep', 'design', 'edit', 'thumb', 'review', 'ready']

// Which stages a post format's kind goes through, in order, and whether it counts toward the
// "videos" target (Reels/YouTube/Live).
export const KIND_INFO: Record<Kind, { label: string; stages: Stage[]; isVideo: boolean }> = {
    video: { label: '🎬 ভিডিও', stages: ['idea', 'script', 'shoot', 'edit', 'review', 'ready'], isVideo: true },
    photo: { label: '📷 ছবি ও ডিজাইন', stages: ['idea', 'shoot', 'design', 'review', 'ready'], isVideo: false },
    design: { label: '🎨 শুধু ডিজাইন', stages: ['idea', 'design', 'review', 'ready'], isVideo: false },
    text: { label: '✍️ শুধু লেখা', stages: ['idea', 'review', 'ready'], isVideo: false },
    live: { label: '🔴 লাইভ', stages: ['plan', 'prep', 'ready'], isVideo: true },
}

export const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube'] as const
export type Platform = typeof PLATFORMS[number]

export interface SlotLike { date: string; posted: boolean }
export interface ItemLike { stage: string; slots: SlotLike[] }

/** Overall phase of an item, used for board columns and pills. */
export function phaseOf(item: ItemLike): 'making' | 'review' | 'ready' | 'done' {
    if (item.slots.length && item.slots.every(s => s.posted)) return 'done'
    if (item.stage === 'ready') return 'ready'
    if (item.stage === 'review') return 'review'
    return 'making'
}

export function isActivePhase(item: ItemLike): boolean {
    const p = phaseOf(item)
    return p === 'making' || p === 'review'
}

export function firstDateOf(item: ItemLike): string {
    return item.slots.reduce((min, s) => (!min || s.date < min ? s.date : min), '')
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export function isSlotLate(slot: SlotLike): boolean {
    return !slot.posted && slot.date < todayStr()
}

export function isItemLate(item: ItemLike): boolean {
    const first = firstDateOf(item)
    if (isActivePhase(item) && first && first <= todayStr()) return true
    return item.slots.some(isSlotLate)
}

/** The next stage after `stage` for a given kind, or null if already at the last stage. */
export function nextStageOf(kind: Kind, stage: string): Stage | null {
    const stages = KIND_INFO[kind]?.stages || KIND_INFO.video.stages
    const i = stages.indexOf(stage as Stage)
    if (i < 0 || i >= stages.length - 1) return null
    return stages[i + 1]
}

/**
 * Stagger multiple channels on the same platform `gapDays` apart, in the given channel order
 * (the caller decides order — e.g. whichever channel is currently least busy goes first).
 * Simpler than the reference artifact's auto-pick-the-least-busy-first-channel rule: here the
 * first channel is whatever order the caller passes, not auto-detected from existing load.
 */
export function buildSlotDates(channelIdsByPlatform: string[], startDate: string, gapDays: number): { channelId: string; date: string }[] {
    const gap = Math.max(0, gapDays || 0)
    return channelIdsByPlatform.map((channelId, k) => ({ channelId, date: addDays(startDate, gap * k) }))
}

export function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
    const dt = new Date(y, (m || 1) - 1 + 0, (d || 1) + days)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
