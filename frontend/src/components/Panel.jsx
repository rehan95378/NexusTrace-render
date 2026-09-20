import { motion } from 'framer-motion'

export default function Panel({ title, hint, children, className = '' }) {
  return (
    <motion.section
      className={`bg-panel border border-border-light rounded-md p-5 md:p-6 dark:bg-dark-panel dark:border-dark-border ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {(title || hint) && (
        <div className="mb-4 md:mb-6">
          {title && (
            <h2 className="font-display text-xl md:text-2xl font-semibold text-text mb-1 dark:text-dark-text">
              {title}
            </h2>
          )}
          {hint && (
            <p className="text-sm text-muted leading-relaxed dark:text-dark-muted">{hint}</p>
          )}
        </div>
      )}
      {children}
    </motion.section>
  )
}