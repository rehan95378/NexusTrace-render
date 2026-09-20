/**
 * Simple tabs component for tabbed interfaces
 */

export function Tabs({ value, onValueChange, children, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  )
}

export function TabsList({ children, className = '' }) {
  return (
    <div className={`flex gap-2 border-b border-light-border dark:border-border ${className}`}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className = '' }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${className}`}
      data-value={value}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
