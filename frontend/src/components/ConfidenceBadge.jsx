import { motion } from 'framer-motion'

/**
 * Confidence badges show reasoning and scoring for detections.
 * Used in anomalies, key players, and other analysis tabs.
 */

export function ConfidenceBadge({ score, label = 'Confidence', variant = 'default' }) {
  // score should be 0-100
  const normalized = Math.min(100, Math.max(0, score))

  const getColor = () => {
    if (normalized >= 80) return 'bg-success/20 text-success border-success/30'
    if (normalized >= 60) return 'bg-warning/20 text-warning border-warning/30'
    if (normalized >= 40) return 'bg-accent/20 text-accent border-accent/30'
    return 'bg-danger/20 text-danger border-danger/30'
  }

  const getIcon = () => {
    if (normalized >= 80) return '✓'
    if (normalized >= 60) return '◐'
    if (normalized >= 40) return '◑'
    return '✗'
  }

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border ${getColor()}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <span>{getIcon()}</span>
      <span className="font-mono">{label}: {normalized.toFixed(0)}%</span>
    </motion.span>
  )
}

export function ReasoningBadge({ reason, variant = 'info' }) {
  const colorMap = {
    info: 'bg-info/10 text-info border-info/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    success: 'bg-success/10 text-success border-success/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  }

  return (
    <motion.div
      className={`flex items-start gap-2 px-3 py-2 rounded-sm border text-xs ${colorMap[variant]}`}
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="flex-shrink-0 mt-0.5">ℹ</span>
      <span className="leading-relaxed">{reason}</span>
    </motion.div>
  )
}

export function ScoreBar({ score, label, showLabel = true }) {
  const normalized = Math.min(100, Math.max(0, score))

  const getBarColor = () => {
    if (normalized >= 80) return 'bg-success'
    if (normalized >= 60) return 'bg-warning'
    if (normalized >= 40) return 'bg-accent'
    return 'bg-danger'
  }

  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="text-xs text-light-muted dark:text-muted min-w-[80px]">{label}</span>}
      <div className="flex-1 h-1.5 bg-light-border dark:bg-border rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getBarColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${normalized}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-light-muted dark:text-muted min-w-[35px] text-right">
        {normalized.toFixed(0)}%
      </span>
    </div>
  )
}

export function RankingBadge({ rank, total }) {
  return (
    <motion.span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
    >
      {rank}/{total}
    </motion.span>
  )
}
