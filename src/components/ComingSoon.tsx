'use client'

import { motion } from 'framer-motion'

interface ComingSoonProps {
    title: string
    description?: string
    icon?: React.ReactNode
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
}

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }
}

export default function ComingSoon({ title, description, icon }: ComingSoonProps) {
    return (
        <motion.div
            className="coming-soon-container"
            variants={container}
            initial="hidden"
            animate="show"
        >
            <motion.div className="coming-soon-card" variants={item}>
                <motion.div
                    className="coming-soon-icon-wrapper"
                    variants={item}
                    animate={{
                        y: [0, -8, 0],
                    }}
                    transition={{
                        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                    }}
                >
                    {icon || (
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <rect width="48" height="48" rx="14" fill="url(#cs-gradient)" />
                            <path d="M16 24h16M24 16v16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            <defs>
                                <linearGradient id="cs-gradient" x1="0" y1="0" x2="48" y2="48">
                                    <stop stopColor="#1E40AF" />
                                    <stop offset="1" stopColor="#3B82F6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    )}
                </motion.div>

                <motion.div className="coming-soon-badge" variants={item}>
                    <span className="coming-soon-dot" />
                    Coming Soon
                </motion.div>

                <motion.h1 className="coming-soon-title" variants={item}>
                    {title}
                </motion.h1>

                <motion.p className="coming-soon-description" variants={item}>
                    {description || 'We\'re working hard to bring you this feature. Stay tuned for updates!'}
                </motion.p>

                <motion.div className="coming-soon-progress" variants={item}>
                    <div className="coming-soon-progress-bar">
                        <motion.div
                            className="coming-soon-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: '35%' }}
                            transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="coming-soon-progress-label">In Development</span>
                </motion.div>

                <motion.div className="coming-soon-features" variants={item}>
                    <div className="coming-soon-feature">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--color-primary)">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Feature planned &amp; designed</span>
                    </div>
                    <div className="coming-soon-feature">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--color-primary)">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Development in progress</span>
                    </div>
                    <div className="coming-soon-feature coming-soon-feature-pending">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--color-text-tertiary)">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span>Launching soon</span>
                    </div>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}
