'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function FloatingCalculator() {
    const [isOpen, setIsOpen] = useState(false)
    const [expr, setExpr] = useState('0')
    const [cursorVisible, setCursorVisible] = useState(true)
    const [activePanel, setActivePanel] = useState<'main' | 'history' | 'scientific' | 'converter'>('main')
    const [history, setHistory] = useState<{expr: string, res: string}[]>([])

    // Blinking cursor effect
    useEffect(() => {
        if (!isOpen) return
        const interval = setInterval(() => setCursorVisible(v => !v), 530)
        return () => clearInterval(interval)
    }, [isOpen])

    const handleInput = useCallback((char: string) => {
        setExpr(prev => {
            if (prev === '0' && char !== '.' && char !== '÷' && char !== '×' && char !== '+' && char !== '-') {
                return char
            }
            return prev + char
        })
    }, [])

    const handleClear = useCallback(() => {
        setExpr('0')
    }, [])

    const handleBackspace = useCallback(() => {
        setExpr(prev => prev.length <= 1 ? '0' : prev.slice(0, -1))
    }, [])

    const handleToggleSign = useCallback(() => {
        setExpr(prev => {
            // Very simple sign toggle for the last number
            const match = prev.match(/(-?[\d.]+)$/)
            if (match) {
                const num = match[0]
                const toggled = num.startsWith('-') ? num.slice(1) : '-' + num
                return prev.slice(0, -num.length) + toggled
            }
            if (prev === '0') return prev
            return prev + '-'
        })
    }, [])

    const handleParens = useCallback(() => {
        setExpr(prev => {
            const openCount = (prev.match(/\(/g) || []).length
            const closeCount = (prev.match(/\)/g) || []).length
            const lastChar = prev.slice(-1)

            if (openCount > closeCount && (/\d/.test(lastChar) || lastChar === ')')) {
                return prev + ')'
            }
            if (prev === '0') return '('
            if (/\d/.test(lastChar) || lastChar === ')') return prev + '×('
            return prev + '('
        })
    }, [])

    const handleEquals = useCallback(() => {
        try {
            let safeExpr = expr.replace(/×/g, '*').replace(/÷/g, '/')
            safeExpr = safeExpr.replace(/%/g, '/100')
            // Map functions/constants to unique placeholders FIRST so later substitutions
            // can't re-match each other (the old code turned ln( -> Math.log( -> Math.Math.log10().
            safeExpr = safeExpr.replace(/√\(/g, 'SQRT(')
            safeExpr = safeExpr.replace(/sin\(/g, 'SIN(')
            safeExpr = safeExpr.replace(/cos\(/g, 'COS(')
            safeExpr = safeExpr.replace(/tan\(/g, 'TAN(')
            safeExpr = safeExpr.replace(/ln\(/g, 'LN(')
            safeExpr = safeExpr.replace(/log\(/g, 'LOG(')
            safeExpr = safeExpr.replace(/π/g, 'PI_C')
            // Replace a STANDALONE e (Euler's number) only — not the e inside a number like 2e3.
            safeExpr = safeExpr.replace(/(?<![A-Za-z0-9.])e(?![A-Za-z0-9])/g, 'EUL_C')
            safeExpr = safeExpr.replace(/\^/g, '**')
            safeExpr = safeExpr.replace(/([0-9.]+)!/g, 'factorial($1)')
            // Now expand placeholders to their real Math.* values.
            safeExpr = safeExpr.replace(/SQRT\(/g, 'Math.sqrt(')
            safeExpr = safeExpr.replace(/SIN\(/g, 'Math.sin(')
            safeExpr = safeExpr.replace(/COS\(/g, 'Math.cos(')
            safeExpr = safeExpr.replace(/TAN\(/g, 'Math.tan(')
            safeExpr = safeExpr.replace(/LN\(/g, 'Math.log(')
            safeExpr = safeExpr.replace(/LOG\(/g, 'Math.log10(')
            safeExpr = safeExpr.replace(/PI_C/g, 'Math.PI')
            safeExpr = safeExpr.replace(/EUL_C/g, 'Math.E')

            const openCount = (safeExpr.match(/\(/g) || []).length
            const closeCount = (safeExpr.match(/\)/g) || []).length
            safeExpr += ')'.repeat(Math.max(0, openCount - closeCount))

            // Iterative factorial with guards (recursion overflowed / accepted decimals & negatives before).
            const factorial = (n: number): number => {
                if (n < 0 || !Number.isInteger(n)) return NaN
                if (n > 170) return Infinity
                let r = 1
                for (let i = 2; i <= n; i++) r *= i
                return r
            }
            // eslint-disable-next-line no-new-func
            const evaluateFunc = new Function('Math', 'factorial', 'return ' + safeExpr)
            const result = evaluateFunc(Math, factorial)

            if (!isFinite(result) || isNaN(result)) return

            const resStr = String(parseFloat(result.toFixed(10)))
            setHistory(prev => [{ expr: expr, res: resStr }, ...prev].slice(0, 50))
            setExpr(resStr)
        } catch {
            // If invalid, do nothing
        }
    }, [expr])

    const getButtonStyle = (bg: string, color: string): React.CSSProperties => ({
        width: '100%',
        aspectRatio: '1/1',
        borderRadius: '50%',
        border: 'none',
        background: bg,
        color: color,
        fontSize: '1.75rem',
        fontWeight: 400,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: bg === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
        transition: 'filter 0.1s',
    })

    return (
        <>
            {/* Floating Toggle Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #1ea31d 0%, #178a16 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(30,163,29,0.35), 0 2px 8px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                title="Calculator"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="8" y1="14" x2="16" y2="14" />
                    <line x1="8" y1="10" x2="16" y2="10" />
                    <line x1="8" y1="18" x2="16" y2="18" />
                    <line x1="12" y1="10" x2="12" y2="18" />
                </svg>
            </motion.button>

            {/* Android Calculator Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        style={{
                            position: 'fixed',
                            bottom: '88px',
                            right: '24px',
                            width: '340px',
                            height: '620px',
                            borderRadius: '32px',
                            overflow: 'hidden',
                            zIndex: 1000,
                            background: '#f8f9fa',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,1)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Display Area */}
                        <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', overflow: 'hidden' }}>
                            <div style={{ flex: 1 }} /> {/* Push content down safely */}
                            <div style={{
                                fontSize: expr.length > 30 ? '1.25rem' : expr.length > 20 ? '1.75rem' : expr.length > 12 ? '2.25rem' : expr.length > 8 ? '3rem' : '4rem',
                                fontWeight: 300,
                                color: '#202124',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                wordBreak: 'break-all',
                                textAlign: 'right',
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                                display: 'inline',
                            }}>
                                {expr}
                                <span style={{ display: 'inline-block', width: '3px', height: '0.9em', background: '#1ea31d', marginLeft: '4px', verticalAlign: 'text-bottom', opacity: cursorVisible ? 1 : 0, transition: 'opacity 0.1s' }} />
                            </div>
                        </div>

                        {/* Middle Icons Row */}
                        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f3f4' }}>
                            <div style={{ display: 'flex', gap: '24px', color: '#737579' }}>
                                {/* History Icon */}
                                <button onClick={() => setActivePanel(p => p === 'history' ? 'main' : 'history')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: activePanel === 'history' ? '#1ea31d' : 'inherit', display: 'flex' }} title="History">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </button>
                                {/* Ruler Icon */}
                                <button onClick={() => setActivePanel(p => p === 'converter' ? 'main' : 'converter')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: activePanel === 'converter' ? '#1ea31d' : 'inherit', display: 'flex' }} title="Unit Converter">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6" y2="12"></line><line x1="10" y1="8" x2="10" y2="10"></line><line x1="14" y1="8" x2="14" y2="12"></line><line x1="18" y1="8" x2="18" y2="10"></line></svg>
                                </button>
                                {/* Math Icon */}
                                <button onClick={() => setActivePanel(p => p === 'scientific' ? 'main' : 'scientific')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: activePanel === 'scientific' ? '#1ea31d' : 'inherit', display: 'flex' }} title="Scientific">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="12" x2="16" y2="12"></line><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                                </button>
                            </div>
                            {/* Backspace */}
                            <button onClick={handleBackspace} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1ea31d', display: 'flex' }} title="Backspace">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" />
                                    <line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                            </button>
                        </div>

                        {/* Panels Container */}
                        <div style={{ position: 'relative', flexShrink: 0, height: '420px', overflow: 'hidden' }}>
                            {/* Main Keypad */}
                            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', position: 'absolute', inset: 0, opacity: activePanel === 'main' ? 1 : 0, pointerEvents: activePanel === 'main' ? 'auto' : 'none', transition: 'opacity 0.2s', background: '#f8f9fa' }}>
                                <button onClick={handleClear} style={getButtonStyle('#f1f3f4', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>C</button>
                                <button onClick={handleParens} style={getButtonStyle('#f1f3f4', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>( )</button>
                                <button onClick={() => handleInput('%')} style={getButtonStyle('#f1f3f4', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>%</button>
                                <button onClick={() => handleInput('÷')} style={getButtonStyle('#737579', '#ffffff')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(1.15)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>÷</button>

                                <button onClick={() => handleInput('7')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>7</button>
                                <button onClick={() => handleInput('8')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>8</button>
                                <button onClick={() => handleInput('9')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>9</button>
                                <button onClick={() => handleInput('×')} style={getButtonStyle('#737579', '#ffffff')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(1.15)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>×</button>

                                <button onClick={() => handleInput('4')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>4</button>
                                <button onClick={() => handleInput('5')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>5</button>
                                <button onClick={() => handleInput('6')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>6</button>
                                <button onClick={() => handleInput('-')} style={getButtonStyle('#737579', '#ffffff')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(1.15)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>-</button>

                                <button onClick={() => handleInput('1')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>1</button>
                                <button onClick={() => handleInput('2')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>2</button>
                                <button onClick={() => handleInput('3')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>3</button>
                                <button onClick={() => handleInput('+')} style={getButtonStyle('#737579', '#ffffff')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(1.15)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>+</button>

                                <button onClick={handleToggleSign} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>+/-</button>
                                <button onClick={() => handleInput('0')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>0</button>
                                <button onClick={() => handleInput('.')} style={getButtonStyle('#ffffff', '#202124')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(0.95)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>.</button>
                                <button onClick={handleEquals} style={getButtonStyle('#1ea31d', '#ffffff')} onMouseEnter={e => (e.target as HTMLElement).style.filter = 'brightness(1.15)'} onMouseLeave={e => (e.target as HTMLElement).style.filter = 'none'}>=</button>
                            </div>

                            {/* History Panel */}
                            <div style={{ position: 'absolute', inset: 0, background: '#f8f9fa', padding: '16px', overflowY: 'auto', opacity: activePanel === 'history' ? 1 : 0, pointerEvents: activePanel === 'history' ? 'auto' : 'none', transition: 'opacity 0.2s', zIndex: 10 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#202124', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>History</span>
                                    <button onClick={() => setHistory([])} style={{ background: 'none', border: 'none', color: '#1ea31d', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                                </div>
                                {history.length === 0 ? (
                                    <div style={{ color: '#737579', textAlign: 'center', marginTop: '32px' }}>No history yet</div>
                                ) : (
                                    history.map((h, i) => (
                                        <div key={i} onClick={() => { setExpr(h.res); setActivePanel('main'); }} style={{ padding: '12px', background: '#ffffff', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                            <div style={{ color: '#737579', fontSize: '0.875rem', marginBottom: '4px', textAlign: 'right' }}>{h.expr} =</div>
                                            <div style={{ color: '#202124', fontSize: '1.25rem', fontWeight: 500, textAlign: 'right' }}>{h.res}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Scientific Panel */}
                            <div style={{ position: 'absolute', inset: 0, background: '#f8f9fa', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', opacity: activePanel === 'scientific' ? 1 : 0, pointerEvents: activePanel === 'scientific' ? 'auto' : 'none', transition: 'opacity 0.2s', zIndex: 10 }}>
                                <button onClick={() => handleInput('sin(')} style={getButtonStyle('#ffffff', '#202124')}>sin</button>
                                <button onClick={() => handleInput('cos(')} style={getButtonStyle('#ffffff', '#202124')}>cos</button>
                                <button onClick={() => handleInput('tan(')} style={getButtonStyle('#ffffff', '#202124')}>tan</button>
                                <button onClick={() => handleInput('π')} style={getButtonStyle('#f1f3f4', '#202124')}>π</button>

                                <button onClick={() => handleInput('ln(')} style={getButtonStyle('#ffffff', '#202124')}>ln</button>
                                <button onClick={() => handleInput('log(')} style={getButtonStyle('#ffffff', '#202124')}>log</button>
                                <button onClick={() => handleInput('e')} style={getButtonStyle('#f1f3f4', '#202124')}>e</button>
                                <button onClick={() => handleInput('^')} style={getButtonStyle('#f1f3f4', '#202124')}>^</button>

                                <button onClick={() => handleInput('√(')} style={getButtonStyle('#ffffff', '#202124')}>√</button>
                                <button onClick={() => handleInput('!')} style={getButtonStyle('#f1f3f4', '#202124')}>!</button>
                                <div style={{ gridColumn: 'span 2' }} />

                                <button onClick={() => setActivePanel('main')} style={{ ...getButtonStyle('#1ea31d', '#ffffff'), gridColumn: 'span 4', borderRadius: '16px', aspectRatio: 'auto', height: '54px' }}>Back to Standard</button>
                            </div>

                            {/* Converter Panel */}
                            <div style={{ position: 'absolute', inset: 0, background: '#f8f9fa', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', opacity: activePanel === 'converter' ? 1 : 0, pointerEvents: activePanel === 'converter' ? 'auto' : 'none', transition: 'opacity 0.2s', zIndex: 10 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#202124', marginBottom: '8px' }}>Length Converter</div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="number" placeholder="Meters" id="m_input" style={{ flex: 1, width: '100%', minWidth: '0', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', fontSize: '1.125rem' }} onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        (document.getElementById('ft_input') as HTMLInputElement).value = isNaN(v) ? '' : (v * 3.28084).toFixed(2);
                                    }}/>
                                    <span style={{ color: '#737579', fontWeight: 600 }}>=</span>
                                    <input type="number" placeholder="Feet" id="ft_input" style={{ flex: 1, width: '100%', minWidth: '0', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', fontSize: '1.125rem' }} onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        (document.getElementById('m_input') as HTMLInputElement).value = isNaN(v) ? '' : (v / 3.28084).toFixed(2);
                                    }}/>
                                </div>

                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#202124', marginTop: '16px', marginBottom: '8px' }}>Weight Converter</div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="number" placeholder="KG" id="kg_input" style={{ flex: 1, width: '100%', minWidth: '0', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', fontSize: '1.125rem' }} onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        (document.getElementById('lb_input') as HTMLInputElement).value = isNaN(v) ? '' : (v * 2.20462).toFixed(2);
                                    }}/>
                                    <span style={{ color: '#737579', fontWeight: 600 }}>=</span>
                                    <input type="number" placeholder="LBs" id="lb_input" style={{ flex: 1, width: '100%', minWidth: '0', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', fontSize: '1.125rem' }} onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        (document.getElementById('kg_input') as HTMLInputElement).value = isNaN(v) ? '' : (v / 2.20462).toFixed(2);
                                    }}/>
                                </div>

                                <div style={{ flex: 1 }} />
                                <button onClick={() => setActivePanel('main')} style={{ ...getButtonStyle('#1ea31d', '#ffffff'), borderRadius: '16px', aspectRatio: 'auto', height: '54px' }}>Back to Calculator</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
