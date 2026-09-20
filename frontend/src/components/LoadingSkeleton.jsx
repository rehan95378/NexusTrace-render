import { motion } from 'framer-motion'

/**
 * Reusable loading skeleton components for smooth state transitions.
 * Uses animated gradients instead of plain gray boxes.
 */

export function SkeletonRow() {
  return (
    <motion.div
      className="flex items-center gap-4 py-4"
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-1/4" />
      <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-1/3" />
      <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-1/6" />
    </motion.div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <motion.div
      className="p-4 bg-light-panel dark:bg-panel border border-light-border dark:border-border rounded-lg"
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="h-5 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-3/4 mb-3" />
      <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-full mb-2" />
      <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-5/6" />
    </motion.div>
  )
}

export function SkeletonGrid({ cols = 3, rows = 2 }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonGraphContainer() {
  return (
    <motion.div
      className="w-full h-full bg-light-panel dark:bg-panel border border-light-border dark:border-border rounded-lg"
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-6 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-40 mx-auto mb-2" />
          <div className="h-4 bg-gradient-to-r from-light-border to-light-panel-raised dark:from-border dark:to-panel-raised rounded w-32 mx-auto" />
        </div>
      </div>
    </motion.div>
  )
}
