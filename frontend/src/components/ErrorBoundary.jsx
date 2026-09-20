import React from 'react'
import { motion } from 'framer-motion'
import Panel from './Panel'

/**
 * Error boundary for catching and displaying component errors gracefully.
 * Prevents the entire app from crashing on local component failures.
 */

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <Panel title="Component Error">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
              <span className="text-danger text-lg flex-shrink-0">⚠</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-danger">Something went wrong</p>
                <p className="text-xs text-danger/80 mt-1 break-words">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-xs text-light-muted dark:text-muted">
                <summary className="cursor-pointer font-mono hover:text-light-text dark:hover:text-text">
                  Stack trace (development only)
                </summary>
                <pre className="mt-2 p-2 bg-light-panel-raised dark:bg-panel-raised rounded overflow-auto max-h-48 text-[0.7rem]">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleRetry}
                className="px-3 py-2 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 border border-light-border dark:border-border text-light-text dark:text-text rounded-lg hover:bg-light-panel-raised dark:hover:bg-panel-raised transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
              >
                Reload Page
              </button>
            </div>
          </motion.div>
        </Panel>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
