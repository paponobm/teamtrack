import { IconFacebook, IconWhatsApp, IconInstagram, IconTikTok, IconYouTube } from '@/components/icons/Icons'

// Shared between InfluencersTab's Add form and InfluencerProfileModal's Edit form, so
// both stay in sync rather than risking drift from two separate copies.
export const CONTACT_SOURCES: { key: string; label: string; placeholder: string }[] = [
    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
    { key: 'whatsapp', label: 'WhatsApp', placeholder: '01XXXXXXXXX' },
    { key: 'email', label: 'Email', placeholder: 'name@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '01XXXXXXXXX' },
]

// Platforms an influencer can be checked off as uploading video content to — used by
// both the Add/Edit forms (checkboxes) and the card (icon-only, no links).
export const PLATFORMS: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: 'facebook', label: 'Facebook', icon: <IconFacebook size={15} color="#1877F2" /> },
    { key: 'whatsapp', label: 'WhatsApp', icon: <IconWhatsApp size={15} color="#25D366" /> },
    { key: 'instagram', label: 'Instagram', icon: <IconInstagram size={15} color="#E1306C" /> },
    { key: 'tiktok', label: 'TikTok', icon: <IconTikTok size={15} color="var(--color-text-primary)" /> },
    { key: 'youtube', label: 'YouTube', icon: <IconYouTube size={15} color="#FF0000" /> },
]
