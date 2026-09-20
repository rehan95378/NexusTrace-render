import { motion } from 'framer-motion'

/**
 * Keyboard shortcuts reference overlay.
 * Shows on Cmd+? or Ctrl+? in the app.
 */

export function KeyboardShortcuts({ isOpen, onClose }) {
  if (!isOpen) return null

  const shortcuts = [
    { key: 'Cmd+B / Ctrl+B', action: 'Toggle sidebar' },
    { key: 'Cmd+? / Ctrl+?', action: 'Show this help' },
    { key: 'Tab', action: 'Navigate between tabs' },
    { key: 'Enter', action: 'Submit form or confirm action' },
    { key: 'Esc', action: 'Close dialogs and panels' },
  ]

  return (
    <motion.div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="bg-light-panel dark:bg-panel border border-light-border dark:border-border rounded-lg shadow-elevated max-w-sm w-[calc(100%-2rem)]"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-6 border-b border-light-border dark:border-border">
          <h2 className="font-display text-lg font-semibold text-light-text dark:text-text">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-light-muted dark:text-muted mt-1">Quick navigation and actions</p>
        </div>

        <div className="p-6 space-y-3">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-light-muted dark:text-muted">{action}</span>
              <kbd className="px-2 py-1 bg-light-panel-raised dark:bg-panel-raised border border-light-border dark:border-border rounded text-xs font-mono text-light-text dark:text-text">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-light-border dark:border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-light-text dark:text-text hover:bg-light-panel-raised dark:hover:bg-panel-raised rounded-lg transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default KeyboardShortcuts
