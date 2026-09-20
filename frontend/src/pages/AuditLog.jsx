import Panel from '../components/Panel'
import { useAuditTrail } from '../hooks/useQueries'
import { motion } from 'framer-motion'

export default function AuditLog() {
  const { data, isLoading } = useAuditTrail()

  return (
    <div className="space-y-6">
      <Panel title="Tamper-Evident Audit Log" hint="Immutable record of all system actions">
        {isLoading ? (
          <div className="text-center py-8 text-light-muted dark:text-muted">
            Loading audit trail...
          </div>
        ) : data?.entries?.length > 0 ? (
          <div className="space-y-2">
            {data.entries.map((entry, idx) => (
              <motion.div
                key={`${entry.case_id}-${entry.seq}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-start gap-3 p-3 bg-light-panel-raised dark:bg-panel-raised border border-light-border dark:border-border/50 rounded-lg"
              >
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent mt-1.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-light-text dark:text-text">{entry.action}</p>
                    <span className="text-xs text-light-muted dark:text-muted font-mono flex-shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-light-muted dark:text-muted mt-1">{entry.case_id}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-light-muted dark:text-muted">
            No audit entries yet
          </div>
        )}
      </Panel>
    </div>
  )
}
