/**
 * Badge component library for consistent, professional status indicators.
 * Used throughout the app for status, tags, labels, and more.
 */

import { motion } from 'framer-motion'

/**
 * Status badges with semantic colors and icons.
 */
export function StatusBadge({ status, size = 'sm' }) {
  const statusMap = {
    success: { bg: 'bg-success/10', text: 'text-success', icon: '✓', label: 'Success' },
    error: { bg: 'bg-danger/10', text: 'text-danger', icon: '✗', label: 'Error' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', icon: '!', label: 'Warning' },
    info: { bg: 'bg-info/10', text: 'text-info', icon: 'ⓘ', label: 'Info' },
    pending: { bg: 'bg-light-muted/10 dark:bg-muted/10', text: 'text-light-muted dark:text-muted', icon: '○', label: 'Pending' },
  }

  const config = statusMap[status] || statusMap.info
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <motion.span
      className={`inline-flex items-center gap-1 rounded-sm font-medium border ${config.bg} ${config.text} ${sizeClass}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </motion.span>
  )
}

/**
 * Tag badges for entity types, categories, labels.
 */
export function TagBadge({ label, color = 'accent', removable = false, onRemove }) {
  const colorMap = {
    accent: 'bg-accent/10 text-accent border-accent/30',
    teal: 'bg-teal/10 text-teal border-teal/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    success: 'bg-success/10 text-success border-success/30',
    info: 'bg-info/10 text-info border-info/30',
  }

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border ${colorMap[color]}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <span>{label}</span>
      {removable && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition-opacity"
          aria-label="Remove tag"
        >
          ✕
        </button>
      )}
    </motion.span>
  )
}

/**
 * Pill badges for entity counts and statistics.
 */
export function PillBadge({ count, label, icon = '●', variant = 'default' }) {
  const variantMap = {
    default: 'bg-light-panel-raised dark:bg-panel-raised border-light-border dark:border-border text-light-text dark:text-text',
    accent: 'bg-accent/20 border-accent/50 text-accent',
    success: 'bg-success/20 border-success/50 text-success',
    warning: 'bg-warning/20 border-warning/50 text-warning',
    danger: 'bg-danger/20 border-danger/50 text-danger',
  }

  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${variantMap[variant]}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <span className="text-[0.65rem]">{icon}</span>
      <span className="font-medium">{count}</span>
      <span className="text-[0.7rem] opacity-75">{label}</span>
    </motion.div>
  )
}

/**
 * Avatar badge for people/profiles.
 */
export function AvatarBadge({ initials, color = 'accent', size = 'sm' }) {
  const sizeMap = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }

  const colorMap = {
    accent: 'bg-accent/20 text-accent',
    teal: 'bg-teal/20 text-teal',
    danger: 'bg-danger/20 text-danger',
    warning: 'bg-warning/20 text-warning',
    success: 'bg-success/20 text-success',
  }

  return (
    <motion.div
      className={`flex items-center justify-center rounded-full font-semibold border ${sizeMap[size]} ${colorMap[color]} border-current/30`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
    >
      {initials}
    </motion.div>
  )
}

export default {
  StatusBadge,
  TagBadge,
  PillBadge,
  AvatarBadge,
}
