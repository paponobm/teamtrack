'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/lib/ToastContext'
import { useLanguage } from '@/lib/LanguageContext'

interface Todo {
    id: string
    title: string
    description: string | null
    completed: boolean
    due_date: string | null
    color: string | null
    is_pinned: boolean
    created_at: string
}

const COLORS = [
    { id: 'default', value: null, label: 'Default' },
    { id: 'red', value: '#fca5a5', label: 'Red' },
    { id: 'orange', value: '#fdba74', label: 'Orange' },
    { id: 'yellow', value: '#fde047', label: 'Yellow' },
    { id: 'green', value: '#86efac', label: 'Green' },
    { id: 'blue', value: '#93c5fd', label: 'Blue' },
    { id: 'purple', value: '#d8b4fe', label: 'Purple' },
]

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.04 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
    exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
}

function translateNumbersBn(num: number | string): string {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
    return String(num).replace(/[0-9]/g, w => bnNums[parseInt(w)])
}

function getCalendarDays(date: Date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevTotalDays = new Date(year, month, 0).getDate()
    const days: { day: number; monthOffset: number; dateString: string }[] = []
    
    // Padding from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = prevTotalDays - i
        const m = month === 0 ? 11 : month - 1
        const y = month === 0 ? year - 1 : year
        days.push({
            day: d,
            monthOffset: -1,
            dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        })
    }
    
    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
        days.push({
            day: i,
            monthOffset: 0,
            dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        })
    }
    
    // Padding from next month
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
        const m = month === 11 ? 0 : month + 1
        const y = month === 11 ? year + 1 : year
        days.push({
            day: i,
            monthOffset: 1,
            dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        })
    }
    return days
}

function CustomDatePicker({
    value,
    onChange,
    placeholder,
    disabled,
    lang,
    direction = 'down'
}: {
    value: string
    onChange: (val: string) => void
    placeholder: string
    disabled?: boolean
    lang: string
    direction?: 'up' | 'down'
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [viewDate, setViewDate] = useState(() => {
        return value ? new Date(value) : new Date()
    })

    const days = getCalendarDays(viewDate)
    const currentYear = viewDate.getFullYear()
    const currentMonth = viewDate.getMonth()

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const monthNamesBn = ['জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
    const monthName = lang === 'bn' ? monthNamesBn[currentMonth] : monthNamesEn[currentMonth]
    const yearString = lang === 'bn' ? translateNumbersBn(currentYear) : currentYear

    const weekdayNamesEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    const weekdayNamesBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
    const weekdays = lang === 'bn' ? weekdayNamesBn : weekdayNamesEn

    const handlePrevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1))
    }

    const handleNextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1))
    }

    const handleSelectDay = (dateString: string) => {
        onChange(dateString)
        setIsOpen(false)
    }

    const handleClear = () => {
        onChange('')
        setIsOpen(false)
    }

    const handleToday = () => {
        const todayStr = new Date().toISOString().split('T')[0]
        onChange(todayStr)
        setIsOpen(false)
    }

    const getDisplayValue = () => {
        if (!value) return placeholder
        try {
            const dateObj = new Date(value)
            if (isNaN(dateObj.getTime())) return placeholder
            return dateObj.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        } catch {
            return value
        }
    }

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '220px' }}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="form-input"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'var(--color-bg-elevated, var(--color-surface))',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    userSelect: 'none'
                }}
            >
                <span style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                    {getDisplayValue()}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'transparent' }} 
                        onClick={() => setIsOpen(false)} 
                    />
                    <motion.div
                        initial={{ opacity: 0, y: direction === 'up' ? -5 : 5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: direction === 'up' ? -5 : 5, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            top: direction === 'up' ? 'auto' : '100%',
                            bottom: direction === 'up' ? '100%' : 'auto',
                            left: 0,
                            marginTop: direction === 'up' ? '0' : '8px',
                            marginBottom: direction === 'up' ? '8px' : '0',
                            width: '280px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '12px',
                            zIndex: 1000,
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <button type="button" onClick={handlePrevMonth} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {monthName} {yearString}
                            </span>
                            <button type="button" onClick={handleNextMonth} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
                            {weekdays.map((day, idx) => (
                                <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                                    {day}
                                </span>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {days.map((item, idx) => {
                                const isSelected = item.dateString === value
                                const isCurrentMonth = item.monthOffset === 0
                                const todayStr = new Date().toISOString().split('T')[0]
                                const isToday = item.dateString === todayStr
                                
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectDay(item.dateString)}
                                        style={{
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: isSelected 
                                                ? 'var(--color-primary)' 
                                                : 'transparent',
                                            color: isSelected
                                                ? '#fff'
                                                : isCurrentMonth
                                                ? 'var(--color-text-primary)'
                                                : 'var(--color-text-tertiary)',
                                            fontWeight: isSelected || isToday ? 600 : 400,
                                            fontSize: '0.8125rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: isToday && !isSelected ? '1px solid var(--color-primary)' : 'none',
                                            transition: 'all 0.15s ease',
                                            opacity: isCurrentMonth ? 1 : 0.5
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) e.currentTarget.style.background = 'transparent'
                                        }}
                                    >
                                        {lang === 'bn' ? translateNumbersBn(item.day) : item.day}
                                    </button>
                                )
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', marginTop: '12px', paddingTop: '8px' }}>
                            <button
                                type="button"
                                onClick={handleClear}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#EF4444',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >
                                {lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
                            </button>
                            <button
                                type="button"
                                onClick={handleToday}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >
                                {lang === 'bn' ? 'আজ' : 'Today'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    )
}

export default function TodoPage() {
    const { t, lang } = useLanguage()
    const toast = useToast()
    const [todos, setTodos] = useState<Todo[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'due_date'>('created_desc')

    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'calendar'>('list')
    const [calendarFilterDate, setCalendarFilterDate] = useState<string | null>(null)

    // Add form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [selectedColor, setSelectedColor] = useState<string | null>(null)
    const [isPinned, setIsPinned] = useState(false)
    const [showFormDetails, setShowFormDetails] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Edit modal/inline state
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editDueDate, setEditDueDate] = useState('')
    const [editColor, setEditColor] = useState<string | null>(null)
    const [editIsPinned, setEditIsPinned] = useState(false)

    const fetchTodos = useCallback(async () => {
        try {
            const res = await fetch('/api/todo')
            if (res.ok) {
                const data = await res.json()
                setTodos(data)
            }
        } catch (error) {
            console.error('Failed to fetch todos:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTodos()
    }, [fetchTodos])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setSubmitting(true)
        try {
            const res = await fetch('/api/todo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    due_date: dueDate || null,
                    color: selectedColor,
                    is_pinned: isPinned
                })
            })

            if (res.ok) {
                const newTodo = await res.json()
                setTodos(prev => [newTodo, ...prev])
                setTitle('')
                setDescription('')
                setDueDate('')
                setSelectedColor(null)
                setIsPinned(false)
                setShowFormDetails(false)
                toast.success(lang === 'bn' ? 'টাস্ক যোগ করা হয়েছে!' : 'Task added successfully!')
                // Reconcile with the server so the added todo is shown from real data
                // (not just the optimistic copy) and survives a refresh.
                fetchTodos()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Failed to add task')
            }
        } catch {
            toast.error('Connection error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggleComplete = async (todo: Todo) => {
        // Optimistic update
        const nextCompleted = !todo.completed
        setTodos(prev =>
            prev.map(t => (t.id === todo.id ? { ...t, completed: nextCompleted } : t))
        )

        try {
            const res = await fetch('/api/todo', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: todo.id,
                    completed: nextCompleted
                })
            })

            if (!res.ok) {
                // Rollback
                setTodos(prev =>
                    prev.map(t => (t.id === todo.id ? { ...t, completed: !nextCompleted } : t))
                )
                toast.error('Failed to update task status')
            } else {
                toast.success(
                    nextCompleted
                        ? lang === 'bn'
                            ? 'টাস্ক সম্পন্ন!'
                            : 'Task completed! 🎉'
                        : lang === 'bn'
                        ? 'টাস্ক পুনরায় সক্রিয় করা হয়েছে'
                        : 'Task marked as active'
                )
            }
        } catch {
            // Rollback
            setTodos(prev =>
                prev.map(t => (t.id === todo.id ? { ...t, completed: !nextCompleted } : t))
            )
            toast.error('Connection error')
        }
    }

    const handleTogglePin = async (todo: Todo) => {
        const nextPinned = !todo.is_pinned
        setTodos(prev =>
            prev.map(t => (t.id === todo.id ? { ...t, is_pinned: nextPinned } : t))
        )
        try {
            const res = await fetch('/api/todo', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: todo.id, is_pinned: nextPinned })
            })
            if (!res.ok) {
                setTodos(prev =>
                    prev.map(t => (t.id === todo.id ? { ...t, is_pinned: !nextPinned } : t))
                )
                toast.error('Failed to update pin status')
            }
        } catch {
            setTodos(prev =>
                prev.map(t => (t.id === todo.id ? { ...t, is_pinned: !nextPinned } : t))
            )
            toast.error('Connection error')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(lang === 'bn' ? 'আপনি কি এটি মুছে ফেলতে চান?' : 'Are you sure you want to delete this task?')) return

        // Save original list for fallback
        const originalTodos = [...todos]
        setTodos(prev => prev.filter(t => t.id !== id))

        try {
            const res = await fetch(`/api/todo?id=${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success(lang === 'bn' ? 'টাস্ক মুছে ফেলা হয়েছে!' : 'Task deleted successfully!')
            } else {
                setTodos(originalTodos)
                toast.error('Failed to delete task')
            }
        } catch {
            setTodos(originalTodos)
            toast.error('Connection error')
        }
    }

    const handleStartEdit = (todo: Todo) => {
        setEditingTodo(todo)
        setEditTitle(todo.title)
        setEditDescription(todo.description || '')
        setEditDueDate(todo.due_date ? todo.due_date.split('T')[0] : '')
        setEditColor(todo.color)
        setEditIsPinned(todo.is_pinned)
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingTodo || !editTitle.trim()) return

        const updatedTodo = {
            ...editingTodo,
            title: editTitle.trim(),
            description: editDescription.trim() || null,
            due_date: editDueDate || null,
            color: editColor,
            is_pinned: editIsPinned
        }

        setTodos(prev => prev.map(t => (t.id === editingTodo.id ? updatedTodo : t)))
        setEditingTodo(null)

        try {
            const res = await fetch('/api/todo', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTodo.id,
                    title: editTitle.trim(),
                    description: editDescription.trim() || null,
                    due_date: editDueDate || null,
                    color: editColor,
                    is_pinned: editIsPinned
                })
            })

            if (res.ok) {
                toast.success(lang === 'bn' ? 'টাস্ক আপডেট করা হয়েছে!' : 'Task updated successfully!')
            } else {
                fetchTodos() // Reset from server
                toast.error('Failed to update task details')
            }
        } catch {
            fetchTodos() // Reset
            toast.error('Connection error')
        }
    }

    // Filter and Sort Logic
    const filteredTodos = todos
        .filter(todo => {
            // Tab filter
            if (activeTab === 'active' && todo.completed) return false
            if (activeTab === 'completed' && !todo.completed) return false

            // Calendar filter
            if (calendarFilterDate) {
                if (!todo.due_date) return false
                if (todo.due_date.split('T')[0] !== calendarFilterDate) return false
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const matchesTitle = todo.title.toLowerCase().includes(query)
                const matchesDesc = (todo.description || '').toLowerCase().includes(query)
                return matchesTitle || matchesDesc
            }
            return true
        })
        .sort((a, b) => {
            // Always put pinned items first if sorting by date/created
            if (a.is_pinned && !b.is_pinned) return -1
            if (!a.is_pinned && b.is_pinned) return 1
            if (sortBy === 'created_desc') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }
            if (sortBy === 'created_asc') {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            if (sortBy === 'due_date') {
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            }
            return 0
        })

    const stats = {
        total: todos.length,
        active: todos.filter(t => !t.completed).length,
        completed: todos.filter(t => t.completed).length
    }

    const renderTodoCard = (todo: Todo, viewType: 'list' | 'grid') => {
        const isOverdue = todo.due_date && new Date(todo.due_date + 'T23:59:59') < new Date() && !todo.completed
        return (
            <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="card todo-card"
                style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: todo.color || 'var(--color-surface)',
                    border: isOverdue ? '1px solid rgba(220,38,38,0.5)' : (todo.color ? '1px solid transparent' : '1px solid var(--color-border-light)'),
                    borderRadius: '8px',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    position: 'relative',
                    cursor: 'pointer',
                    breakInside: 'avoid',
                    marginBottom: viewType === 'grid' ? '16px' : '0',
                    width: '100%',
                    maxWidth: viewType === 'list' ? '600px' : 'none',
                    margin: viewType === 'list' ? '0 auto' : '0 0 16px 0'
                }}
                whileHover={{ boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)', transform: 'translateY(-2px)' }}
                onClick={() => handleStartEdit(todo)}
            >
                {/* Pin Icon (Absolute) */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleTogglePin(todo); }}
                    title={todo.is_pinned ? 'Unpin note' : 'Pin note'}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: todo.is_pinned ? 1 : 0.4,
                        color: todo.color ? '#000' : 'var(--color-text-secondary)',
                        padding: '4px',
                        zIndex: 2,
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = todo.is_pinned ? '1' : '0.4'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={todo.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                    </svg>
                </button>

                <div style={{ paddingRight: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                            style={{
                                fontSize: '1.125rem',
                                fontWeight: 500,
                                color: todo.completed ? (todo.color ? 'rgba(0,0,0,0.5)' : 'var(--color-text-tertiary)') : (todo.color ? '#000' : 'var(--color-text-primary)'),
                                textDecoration: todo.completed ? 'line-through' : 'none',
                                wordBreak: 'break-word',
                                transition: 'all 0.2s',
                                lineHeight: 1.4
                            }}
                        >
                            {todo.title}
                        </span>
                        {isOverdue && (
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.08)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                {lang === 'bn' ? 'অতিক্রান্ত' : 'Overdue'}
                            </span>
                        )}
                    </div>

                    {todo.description && (
                        <p
                            style={{
                                fontSize: '0.875rem',
                                color: todo.completed ? (todo.color ? 'rgba(0,0,0,0.5)' : 'var(--color-text-tertiary)') : (todo.color ? 'rgba(0,0,0,0.8)' : 'var(--color-text-secondary)'),
                                margin: '8px 0 0 0',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                textDecoration: todo.completed ? 'line-through' : 'none'
                            }}
                        >
                            {todo.description}
                        </p>
                    )}

                    {todo.due_date && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '12px', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: isOverdue ? '#DC2626' : (todo.color ? 'rgba(0,0,0,0.7)' : 'var(--color-text-tertiary)'), background: todo.color ? 'rgba(0,0,0,0.05)' : 'var(--color-bg-primary)', fontWeight: isOverdue ? 600 : 500, border: isOverdue ? '1px solid rgba(220,38,38,0.2)' : '1px solid transparent' }}>
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            <span>
                                {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Card Actions (Bottom) */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleComplete(todo); }}
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: todo.completed ? '2px solid #10B981' : (todo.color ? '2px solid rgba(0,0,0,0.4)' : '2px solid var(--color-border)'),
                            background: todo.completed ? '#10B981' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            color: '#fff',
                            transition: 'all 0.15s ease'
                        }}
                        title={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                        {todo.completed && (
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(todo.id); }}
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete task'}
                        style={{ padding: '6px', opacity: 0.6, color: todo.color ? '#000' : 'inherit' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </motion.div>
        )
    }

    const renderCalendarView = () => {
        const baseDate = calendarFilterDate ? new Date(calendarFilterDate) : new Date()
        const days = getCalendarDays(baseDate)
        const weekdayNamesEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
        const weekdayNamesBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']
        const weekdays = lang === 'bn' ? weekdayNamesBn : weekdayNamesEn

        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--color-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                    {weekdays.map(day => (
                        <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', padding: '8px 0', color: 'var(--color-text-tertiary)' }}>{day}</div>
                    ))}
                    {days.map((item, idx) => {
                        const isCurrentMonth = item.monthOffset === 0
                        const dateStr = item.dateString
                        const dayTodos = filteredTodos.filter(t => t.due_date && t.due_date.split('T')[0] === dateStr)
                        const isToday = dateStr === new Date().toISOString().split('T')[0]

                        return (
                            <div key={idx} style={{ 
                                minHeight: '100px', 
                                background: isToday ? 'var(--color-bg-secondary)' : 'transparent', 
                                border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)', 
                                borderRadius: '8px', 
                                padding: '8px',
                                opacity: isCurrentMonth ? 1 : 0.5,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onClick={() => {
                                setDueDate(dateStr)
                                setTitle('')
                                setDescription('')
                                setShowFormDetails(true)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            onMouseEnter={e => {
                                if (!isToday) e.currentTarget.style.background = 'var(--color-bg-secondary)'
                            }}
                            onMouseLeave={e => {
                                if (!isToday) e.currentTarget.style.background = 'transparent'
                            }}
                            >
                                <div style={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--color-primary)' : 'var(--color-text-secondary)', marginBottom: '8px' }}>
                                    {lang === 'bn' ? translateNumbersBn(item.day) : item.day}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {dayTodos.map(t => (
                                        <div key={t.id} onClick={(e) => { e.stopPropagation(); handleStartEdit(t); }} style={{
                                            fontSize: '0.75rem', 
                                            padding: '4px 6px', 
                                            borderRadius: '4px', 
                                            background: t.color || 'var(--color-primary-light)', 
                                            color: t.color ? '#000' : 'var(--color-primary-dark)',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            textDecoration: t.completed ? 'line-through' : 'none',
                                            opacity: t.completed ? 0.6 : 1,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        title={t.title}
                                        >
                                            {t.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div variants={container} animate="show" style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>

            {/* Add Task Quick Form (Keep Style) */}
            <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px', width: '100%' }}>
                <div 
                    className="card" 
                    style={{ 
                        width: '100%', 
                        maxWidth: '600px',
                        background: selectedColor || 'var(--color-surface)',
                        borderRadius: '8px',
                        boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
                        border: '1px solid transparent',
                        overflow: 'visible',
                        transition: 'box-shadow 0.2s, background 0.2s'
                    }}
                >
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                        {!showFormDetails ? (
                            <div 
                                onClick={() => setShowFormDetails(true)}
                                style={{ 
                                    padding: '12px 16px', 
                                    cursor: 'text', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    color: 'var(--color-text-secondary)',
                                    fontWeight: 500,
                                    fontSize: '1rem'
                                }}
                            >
                                <span>{lang === 'bn' ? 'নোট নিন...' : 'Take a note...'}</span>
                                <div style={{ display: 'flex', gap: '16px', opacity: 0.6 }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <input
                                        type="text"
                                        placeholder={lang === 'bn' ? 'শিরোনাম' : 'Title'}
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        required
                                        disabled={submitting}
                                        autoFocus
                                        style={{ 
                                            border: 'none', 
                                            background: 'transparent', 
                                            fontSize: '1rem', 
                                            fontWeight: 500, 
                                            width: '100%', 
                                            outline: 'none',
                                            color: selectedColor ? '#000' : 'var(--color-text-primary)'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsPinned(!isPinned)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: isPinned ? 1 : 0.5, color: selectedColor ? '#000' : 'currentColor', padding: '4px' }}
                                        title="Pin note"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                                        </svg>
                                    </button>
                                </div>

                                <textarea
                                    placeholder={lang === 'bn' ? 'নোট নিন...' : 'Take a note...'}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    disabled={submitting}
                                    style={{ 
                                        border: 'none', 
                                        background: 'transparent', 
                                        fontSize: '0.875rem', 
                                        width: '100%', 
                                        outline: 'none', 
                                        resize: 'none',
                                        minHeight: '40px',
                                        marginTop: '12px',
                                        color: selectedColor ? 'rgba(0,0,0,0.8)' : 'var(--color-text-primary)'
                                    }}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {COLORS.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => setSelectedColor(c.value)}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: c.value || 'var(--color-surface)',
                                                            border: selectedColor === c.value ? '2px solid rgba(0,0,0,0.4)' : `1px solid ${c.value ? 'rgba(0,0,0,0.1)' : 'var(--color-border-light)'}`,
                                                            cursor: 'pointer',
                                                            boxShadow: selectedColor === c.value ? '0 0 0 2px var(--color-bg-primary)' : 'none'
                                                        }}
                                                        title={c.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <CustomDatePicker
                                                value={dueDate}
                                                onChange={setDueDate}
                                                placeholder={lang === 'bn' ? 'শেষ সময়' : 'Due Date'}
                                                disabled={submitting}
                                                lang={lang}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowFormDetails(false)}
                                            className="btn btn-ghost"
                                            style={{ padding: '6px 16px', fontWeight: 600, color: selectedColor ? '#000' : 'inherit' }}
                                        >
                                            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-ghost"
                                            disabled={submitting || !title.trim()}
                                            style={{ padding: '6px 16px', fontWeight: 600, color: title.trim() ? (selectedColor ? '#000' : 'var(--color-primary)') : 'var(--color-text-tertiary)' }}
                                        >
                                            {submitting ? '...' : lang === 'bn' ? 'যোগ করুন' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </motion.div>

            {/* Filter and Control Bar (Keep Style Minimal) */}
            <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '4px', background: 'transparent' }}>
                        {[
                            { key: 'active', label: lang === 'bn' ? 'চলমান' : 'Active' },
                            { key: 'completed', label: lang === 'bn' ? 'সম্পন্ন' : 'Completed' },
                            { key: 'all', label: lang === 'bn' ? 'সব' : 'All' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '16px',
                                    border: activeTab === tab.key ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                                    fontSize: '0.75rem',
                                    fontWeight: activeTab === tab.key ? 600 : 500,
                                    background: activeTab === tab.key ? 'var(--color-primary-light)' : 'transparent',
                                    color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '1px', height: '16px', background: 'var(--color-border-light)', margin: '0 4px' }} />

                    {/* View Modes Toggle */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { key: 'list', icon: <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>, title: 'List View' },
                            { key: 'grid', icon: <path d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zm10-10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z" fill="currentColor"/>, title: 'Grid View' },
                            { key: 'calendar', icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>, title: 'Calendar View' }
                        ].map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => setViewMode(mode.key as any)}
                                style={{
                                    padding: '6px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'transparent',
                                    color: viewMode === mode.key ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                    cursor: 'pointer',
                                    opacity: viewMode === mode.key ? 1 : 0.7,
                                    transition: 'all 0.2s'
                                }}
                                title={mode.title}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    {mode.icon}
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Todo List Content */}
            {loading ? (
                <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div className="skeleton" style={{ width: '50%', height: '14px' }} />
                                <div className="skeleton" style={{ width: '30%', height: '10px' }} />
                            </div>
                        </div>
                    ))}
                </motion.div>
            ) : filteredTodos.length === 0 ? (
                <motion.div variants={itemVariants} style={{ textAlign: 'center', padding: '10vh 24px', background: 'transparent', width: '100%', border: 'none' }}>
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 24px', display: 'block', color: 'var(--color-text-tertiary)', opacity: 0.5 }}>
                        <path d="M9 21h6M10.5 17h3m-5-4v1a2.5 2.5 0 0 0 5 0v-1m-7-3.5C6.5 7.5 9 5 12 5s5.5 2.5 5.5 4.5c0 1.5-1 2.5-2 4-1 1.5-1 2.5-1 4H9.5c0-1.5 0-2.5-1-4-1-1.5-2-2.5-2-4z"/>
                    </svg>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 400, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        {lang === 'bn' ? 'আপনি যে নোট যোগ করবেন তা এখানে দেখা যাবে' : 'Notes you add appear here'}
                    </h3>
                </motion.div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewMode === 'calendar' ? (
                        renderCalendarView()
                    ) : viewMode === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', alignItems: 'start', width: '100%' }}>
                            <AnimatePresence>
                                {filteredTodos.map(todo => renderTodoCard(todo, 'grid'))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {filteredTodos.map(todo => renderTodoCard(todo, 'list'))}
                        </AnimatePresence>
                    )}
                </div>
            )}

            {/* Edit Task Modal */}
            <AnimatePresence>
                {editingTodo && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingTodo(null)}>
                        <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">{lang === 'bn' ? 'টাস্ক সম্পাদন' : 'Edit Task'}</h2>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingTodo(null)}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleSaveEdit}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bn' ? 'শিরোনাম' : 'Title'}</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bn' ? 'বিবরণ' : 'Description'}</label>
                                        <textarea
                                            className="form-input"
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            style={{ minHeight: '80px' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bn' ? 'শেষ সময়' : 'Due Date'}</label>
                                        <CustomDatePicker
                                            value={editDueDate}
                                            onChange={setEditDueDate}
                                            placeholder={lang === 'bn' ? 'তারিখ নির্বাচন' : 'Select date'}
                                            lang={lang}
                                            direction="up"
                                        />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {COLORS.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setEditColor(c.value)}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: c.value || 'var(--color-surface)',
                                                        border: editColor === c.value ? '2px solid var(--color-primary)' : `1px solid ${c.value ? c.value : 'var(--color-border-light)'}`,
                                                        cursor: 'pointer',
                                                        boxShadow: editColor === c.value ? '0 0 0 2px var(--color-bg-primary)' : 'none'
                                                    }}
                                                    title={c.label}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditIsPinned(!editIsPinned)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid',
                                                borderColor: editIsPinned ? 'var(--color-primary)' : 'var(--color-border-light)',
                                                background: editIsPinned ? 'var(--color-primary-light)' : 'transparent',
                                                color: editIsPinned ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                                                cursor: 'pointer',
                                                fontSize: '0.8125rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill={editIsPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                                            </svg>
                                            {lang === 'bn' ? 'পিন' : 'Pin'}
                                        </button>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditingTodo(null)}>
                                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={!editTitle.trim()}>
                                        {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
