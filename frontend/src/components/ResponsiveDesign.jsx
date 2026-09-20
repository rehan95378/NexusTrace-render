/**
 * Responsive design utilities and mobile-optimized components.
 * Ensures the app looks great on all screen sizes.
 */

/**
 * Hook to detect if we're on a mobile device (breakpoint: sm = 640px).
 * Already exists in App.jsx, but exported here for use in other components.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

/**
 * Responsive grid that adapts column count based on screen size.
 */
export function ResponsiveGrid({ children, cols = { sm: 1, md: 2, lg: 3 } }) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)')

  const colCount = isMobile ? cols.sm : isTablet ? cols.md : cols.lg

  return (
    <div className={`grid gap-4 grid-cols-${colCount}`}>
      {children}
    </div>
  )
}

/**
 * Responsive table that converts to a card layout on mobile.
 */
export function ResponsiveTable({ headers, rows, renderRow }) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="p-4 bg-light-panel-raised dark:bg-panel-raised border border-light-border dark:border-border rounded-lg">
            {renderRow(row, true)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-light-muted dark:text-muted font-normal border-b border-light-border dark:border-border">
            {headers.map((header) => (
              <th key={header} className="pb-3 font-medium text-light-text dark:text-text">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-light-border dark:border-border/50 hover:bg-light-panel-raised dark:hover:bg-panel-raised/50 transition-colors">
              {renderRow(row, false)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Touch-friendly button sizing for mobile (larger tap targets).
 */
export function MobileButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`px-3 py-2 sm:px-4 sm:py-2.5 min-h-[44px] sm:min-h-auto touch-target ${props.className || ''}`}
    />
  )
}

export default {
  useMediaQuery,
  ResponsiveGrid,
  ResponsiveTable,
  MobileButton,
}
