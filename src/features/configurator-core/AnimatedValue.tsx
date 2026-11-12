import { AnimatePresence, m } from 'motion/react'

/**
 * Texto que rola ao mudar, como um contador. Usado no total e nas quantidades.
 * Sem animação para quem pediu menos movimento (MotionConfig na raiz).
 */
export function AnimatedValue({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          className="inline-block"
          initial={{ y: '70%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-70%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 36 }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
