'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'

type Language = 'en' | 'bn'

interface LanguageContextType {
    lang: Language
    setLang: (lang: Language) => void
    t: (key: string) => string
    isBn: boolean
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'en',
    setLang: () => { },
    t: (key: string) => key,
    isBn: false,
})

export function useLanguage() {
    return useContext(LanguageContext)
}

// Translations dictionary
const translations: Record<string, Record<Language, string>> = {
    // সাইডবার সেকশন
    'nav.overview': { en: 'Overview', bn: 'ওভারভিউ' },
    'nav.work': { en: 'Work', bn: 'ওয়ার্ক' },
    'nav.people': { en: 'People', bn: 'টিম' },
    'nav.operations': { en: 'Operations', bn: 'অপারেশনস' },
    'nav.settings': { en: 'Settings', bn: 'সেটিংস' },
    'nav.appearance': { en: 'Appearance', bn: 'এপিয়ারেন্স' },

    // সাইডবার আইটেম
    'nav.dashboard': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
    'nav.myProfile': { en: 'My Profile', bn: 'আমার প্রোফাইল' },
    'nav.myAttendance': { en: 'Attendance', bn: 'উপস্থিতি' },
    'nav.noticeboard': { en: 'Noticeboard', bn: 'নোটিশবোর্ড' },
    'nav.workLog': { en: 'Work Log', bn: 'ওয়ার্ক লগ' },
    'nav.problems': { en: 'Problems', bn: 'প্রবলেম' },
    'nav.members': { en: 'Members', bn: 'মেম্বার' },
    // 'nav.attendance': { en: 'Leave', bn: 'ছুটি' },
    'nav.attendance': { en: 'Employee Attendance', bn: 'কর্মচারী উপস্থিতি' },
    'nav.performance': { en: 'Performance', bn: 'পারফরম্যান্স' },
    'nav.courier': { en: 'Courier', bn: 'কুরিয়ার' },
    'nav.expenses': { en: 'Expenses', bn: 'এক্সপেন্স' },
    'nav.requisitions': { en: 'Requisitions', bn: 'রিকুইজিশন' },
    'nav.ideas': { en: 'Ideas', bn: 'আইডিয়া' },
    'nav.content': { en: 'Content', bn: 'কনটেন্ট' },
    'nav.tasks': { en: 'Tasks', bn: 'টাস্ক' },
    'nav.todo': { en: 'To Do', bn: 'টু-ডু' },
    'nav.leaderboard': { en: 'Leaderboard', bn: 'লিডারবোর্ড' },
    'nav.memories': { en: 'Memories', bn: 'স্মৃতি' },
    'nav.permissions': { en: 'Permissions', bn: 'একসেস' },
    'nav.reports': { en: 'Reports', bn: 'রিপোর্ট' },
    'nav.commission': { en: 'Points', bn: 'পয়েন্ট' },
    'nav.auditLog': { en: 'Audit Log', bn: 'অডিট লগ' },
    'nav.settingsLabel': { en: 'Settings', bn: 'সেটিংস' },
    'nav.prManagement': { en: 'PR Management', bn: 'পিআর ম্যানেজমেন্ট' },

    // ড্যাশবোর্ড
    'dash.title': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
    'dash.welcome': { en: "Welcome back! Here's your team overview.", bn: 'ওয়েলকাম! আপনার টিমের আজকের পারফরম্যান্স দেখুন।' },
    'dash.totalMembers': { en: 'Total Members', bn: 'মোট মেম্বার' },
    'dash.todayOrders': { en: "Today's Orders", bn: 'আজকের অর্ডার' },
    'dash.monthlyOrders': { en: 'Monthly Orders', bn: 'মান্থলি অর্ডার' },
    'dash.openProblems': { en: 'Open Problems', bn: 'আনরিসলভড প্রবলেম' },
    'dash.activeToday': { en: 'active today', bn: 'আজ একটিভ' },
    'dash.underControl': { en: 'Under control', bn: 'কন্ট্রোলে আছে' },
    'dash.needsAttention': { en: 'Needs attention', bn: 'এটেনশন দরকার' },
    'dash.todayActivity': { en: "Today's Activity", bn: 'আজকের এক্টিভিটি' },
    'dash.topPerformers': { en: 'Top Performers', bn: 'টপ পারফরমার' },
    'dash.thisMonth': { en: 'This Month', bn: 'এই মাসের' },
    'dash.noActivity': { en: 'No activity yet today', bn: 'আজ এখনো কোন এক্টিভিটি নেই' },
    'dash.noScores': { en: 'No scores yet this month', bn: 'এই মাসে এখনো কোন স্কোর নেই' },
    'dash.noNotices': { en: 'No active notices', bn: 'কোন একটিভ নোটিশ নেই' },
    'dash.noticeboard': { en: 'Noticeboard', bn: 'নোটিশবোর্ড' },
    'dash.orders': { en: 'orders', bn: 'টা অর্ডার' },
    'dash.points': { en: 'points', bn: 'পয়েন্ট' },
    'dash.attendance': { en: 'Attendance', bn: 'এটেনডেন্স' },
    'dash.present': { en: 'Present', bn: 'উপস্থিত' },
    'dash.absent': { en: 'Absent', bn: 'অনুপস্থিত' },
    'dash.late': { en: 'Late', bn: 'লেট' },
    'dash.onLeave': { en: 'On Leave', bn: 'ছুটিতে' },
    'dash.workLog': { en: 'Work Log', bn: 'ওয়ার্ক লগ' },
    'dash.members': { en: 'Members', bn: 'মেম্বার' },
    'dash.activeMembers': { en: 'Active Members', bn: 'একটিভ মেম্বার' },

    // ওয়ার্ক লগ
    'worklog.title': { en: 'Work Log', bn: 'ওয়ার্ক লগ' },
    'worklog.subtitle': { en: 'Daily order submissions', bn: 'ডেইলি অর্ডার সাবমিশন' },
    'worklog.addEntry': { en: 'Add Entry', bn: 'নতুন এন্ট্রি' },
    'worklog.totalOrders': { en: 'Total Orders', bn: 'টোটাল অর্ডার' },
    'worklog.totalAmount': { en: 'Total Amount', bn: 'টোটাল এমাউন্ট' },
    'worklog.advance': { en: 'Advance', bn: 'এডভান্স' },
    'worklog.sources': { en: 'Sources', bn: 'সোর্স' },
    'worklog.noEntries': { en: 'No entries for this date', bn: 'এই ডেটে কোন এন্ট্রি নেই' },
    'worklog.startLogging': { en: 'Start logging work by adding your first entry.', bn: 'প্রথম এন্ট্রি অ্যাড করে ওয়ার্ক লগিং শুরু করুন।' },
    'worklog.sl': { en: 'SL', bn: 'সিরিয়াল' },
    'worklog.member': { en: 'Member', bn: 'মেম্বার' },
    'worklog.customerPhone': { en: 'Customer Phone', bn: 'কাস্টমার ফোন' },
    'worklog.invoice': { en: 'Invoice', bn: 'ইনভয়েস' },
    'worklog.courierId': { en: 'Courier ID', bn: 'কুরিয়ার আইডি' },
    'worklog.source': { en: 'Source', bn: 'সোর্স' },
    'worklog.amount': { en: 'Amount', bn: 'এমাউন্ট' },
    'worklog.status': { en: 'Status', bn: 'স্ট্যাটাস' },
    'worklog.allMembers': { en: 'All Members', bn: 'সব মেম্বার' },
    'worklog.today': { en: 'Today', bn: 'টুডে' },

    // ওয়ার্ক এন্ট্রি মডাল
    'modal.addEntry': { en: 'Add Work Entry', bn: 'ওয়ার্ক এন্ট্রি অ্যাড করুন' },
    'modal.editEntry': { en: 'Edit Entry', bn: 'এন্ট্রি এডিট করুন' },
    'modal.selectMember': { en: 'Select member', bn: 'মেম্বার সিলেক্ট করুন' },
    'modal.orderType': { en: 'Order Type', bn: 'অর্ডার টাইপ' },
    'modal.suggested': { en: 'Suggested', bn: 'সাজেস্টেড' },
    'modal.deliveryStatus': { en: 'Delivery Status', bn: 'ডেলিভারি স্ট্যাটাস' },
    'modal.pending': { en: 'Pending', bn: 'পেন্ডিং' },
    'modal.delivered': { en: 'Delivered', bn: 'ডেলিভার্ড' },
    'modal.cancelled': { en: 'Cancelled', bn: 'ক্যান্সেল' },
    'modal.partial': { en: 'Partial', bn: 'পার্শিয়াল' },
    'modal.note': { en: 'Note', bn: 'নোট' },
    'modal.cancel': { en: 'Cancel', bn: 'ক্যান্সেল' },
    'modal.save': { en: 'Save Changes', bn: 'সেভ করুন' },
    'modal.saving': { en: 'Saving...', bn: 'সেভ হচ্ছে...' },

    // মেম্বার
    'members.title': { en: 'Members', bn: 'মেম্বার' },
    'members.subtitle': { en: 'Manage your team members', bn: 'আপনার টিম মেম্বারদের ম্যানেজ করুন' },
    'members.addMember': { en: 'Add Member', bn: 'মেম্বার অ্যাড করুন' },
    'members.search': { en: 'Search members...', bn: 'মেম্বার সার্চ করুন...' },
    'members.noMembers': { en: 'No members found', bn: 'কোন মেম্বার পাওয়া যায়নি' },

    // পারফরম্যান্স
    'perf.title': { en: 'Performance', bn: 'পারফরম্যান্স' },
    'perf.score': { en: 'Score employees on', bn: 'টিম মেম্বার স্কোর দিন' },
    'perf.categories': { en: 'categories', bn: 'ক্যাটাগরিতে' },
    'perf.max': { en: 'max', bn: 'ম্যাক্স' },
    'perf.pts': { en: 'pts', bn: 'পয়েন্ট' },
    'perf.saveScores': { en: 'Save Scores', bn: 'স্কোর সেভ করুন' },
    'perf.allSaved': { en: 'All Saved', bn: 'সব সেভ হয়েছে' },
    'perf.total': { en: 'Total', bn: 'টোটাল' },

    // একসেস / পারমিশন
    'perm.title': { en: 'Permissions', bn: 'একসেস কন্ট্রোল' },
    'perm.searchMembers': { en: 'Search members...', bn: 'মেম্বার সার্চ করুন...' },
    'perm.allCategories': { en: 'All Categories', bn: 'সব ক্যাটাগরি' },
    'perm.noAccess': { en: 'No Access', bn: 'একসেস নেই' },
    'perm.admin': { en: 'Admin', bn: 'অ্যাডমিন' },
    'perm.clickCycle': { en: 'Click cell to cycle', bn: 'ক্লিক করে চেঞ্জ করুন' },
    'perm.saveChanges': { en: 'Save Changes', bn: 'চেঞ্জ সেভ করুন' },
    'perm.allSaved': { en: 'All Saved', bn: 'সব সেভ হয়েছে' },

    // কমন
    'common.viewAll': { en: 'View all', bn: 'সব দেখুন' },
    'common.search': { en: 'Search anything...', bn: 'সার্চ করুন...' },
    'common.delete': { en: 'Delete', bn: 'ডিলিট' },
    'common.edit': { en: 'Edit', bn: 'এডিট' },
    'common.save': { en: 'Save', bn: 'সেভ' },
    'common.loading': { en: 'Loading...', bn: 'লোড হচ্ছে...' },

    // PR Management
    'pr.title': { en: 'PR Management', bn: 'পিআর ম্যানেজমেন্ট' },
    'pr.subtitle': { en: 'Track product reviews and influencers', bn: 'প্রোডাক্ট রিভিউ ও ইনফ্লুয়েন্সার ট্র্যাকিং' },
    'pr.addBtn': { en: 'Add PR Entry', bn: 'নতুন পিআর অ্যাড' },
    'pr.totalSent': { en: 'Total PR Sent', bn: 'মোট পিআর পাঠানো' },
    'pr.productReceived': { en: 'Product Received', bn: 'প্রোডাক্ট রিসিভড' },
    'pr.videoUploaded': { en: 'Video Uploaded', bn: 'ভিডিও আপলোড' },
    'pr.actionNeeded': { en: 'Action Needed', bn: 'অ্যাকশন দরকার' },
    'pr.search': { en: 'Search by name, phone or parcel...', bn: 'নাম, ফোন বা পার্সেল দিয়ে খুঁজুন...' },
    'pr.filterAll': { en: 'All PRs', bn: 'সব পিআর' },
    'pr.filterPending': { en: 'Pending', bn: 'পেন্ডিং' },
    'pr.filterReceived': { en: 'Received', bn: 'রিসিভড' },
    'pr.filterUploaded': { en: 'Uploaded', bn: 'আপলোড' },
    'pr.noEntries': { en: 'No PR entries found', bn: 'কোন পিআর এন্ট্রি পাওয়া যায়নি' },
    'pr.date': { en: 'Date', bn: 'তারিখ' },
    'pr.customer': { en: 'Customer / Influencer', bn: 'কাস্টমার / ইনফ্লুয়েন্সার' },
    'pr.parcelDetails': { en: 'Parcel Details', bn: 'পার্সেল ডিটেইলস' },
    'pr.source': { en: 'Source', bn: 'সোর্স' },
    'pr.deliveryStatus': { en: 'Delivery Status', bn: 'ডেলিভারি স্ট্যাটাস' },
    'pr.videoStatus': { en: 'Video Status', bn: 'ভিডিও স্ট্যাটাস' },
    'pr.paymentStatus': { en: 'Payment Status', bn: 'পেমেন্ট স্ট্যাটাস' },
    'pr.note': { en: 'Notes', bn: 'নোট' },
    'pr.videoLink': { en: 'Video Link', bn: 'ভিডিও লিংক' },
    'pr.address': { en: 'Address', bn: 'ঠিকানা' },
    'pr.saveEntry': { en: 'Save PR Entry', bn: 'পিআর এন্ট্রি সেভ' },
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('en')

    useEffect(() => {
        const saved = localStorage.getItem('teamtrack-lang') as Language
        if (saved === 'bn' || saved === 'en') setLangState(saved)
    }, [])

    const setLang = useCallback((l: Language) => {
        setLangState(l)
        localStorage.setItem('teamtrack-lang', l)
    }, [])

    // Fall back to the English string before showing the raw dot.case key, so a missing
    // Bengali translation degrades to English instead of leaking "nav.todo" into the UI.
    const t = useCallback((key: string) => {
        return translations[key]?.[lang] || translations[key]?.en || key
    }, [lang])

    const value = useMemo(() => ({ lang, setLang, t, isBn: lang === 'bn' }), [lang, setLang, t])

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    )
}
