/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode (default)
        'light-bg': '#F8FAFC',
        'light-panel': '#FFFFFF',
        'light-panel-raised': '#F1F5F9',
        'light-border': '#CBD5E1',
        'light-text': '#1F2937',
        'light-muted': '#64748B',

        // Dark mode (secondary)
        'dark-bg': '#0f1416',
        'dark-panel': '#161d20',
        'dark-panel-raised': '#1c2528',
        'dark-border': '#2a3538',
        'dark-text': '#e7ece9',
        'dark-muted': '#8fa0a3',

        // Semantic colors (both modes)
        accent: '#0D9488',
        'dark-accent': '#2fa8a0',
        teal: '#0D9488',
        danger: '#DC2626',
        warning: '#D97706',
        success: '#16A34A',
        info: '#0284C7',

        // Deprecated (for backwards compatibility during transition)
        bg: '#0f1416',
        panel: '#161d20',
        'panel-raised': '#1c2528',
        border: '#2a3538',
        text: '#e7ece9',
        muted: '#8fa0a3',
        'accent-dim': '#6b5220',
        'danger-dim': '#4a2320',
        'accent-content': '#14100a',
      },
      fontFamily: {
        display: ['Source Serif 4', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['0.9375rem', { lineHeight: '1.5' }],
        'lg': ['1.125rem', { lineHeight: '1.5' }],
        'xl': ['1.25rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'sm': '3px',
        'md': '4px',
        'lg': '6px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.4)',
        'drawer': '2px 0 16px rgba(0, 0, 0, 0.4)',
      },
      transitionDuration: {
        'fast': '120ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      transitionTimingFunction: {
        'ease-out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      zIndex: {
        'sidebar': '100',
        'overlay': '90',
        'modal': '200',
        'tooltip': '50',
        'dropdown': '40',
      },
    },
  },
  plugins: [],
}