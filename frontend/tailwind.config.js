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
        // Light mode (default) — enterprise analyst palette
        'light-canvas': '#F8FAFC',
        'light-card': '#FFFFFF',
        'light-border': '#CBD5E1',
        'light-border-light': '#E2E8F0',
        'light-text': '#1E293B',
        'light-muted': '#64748B',
        'light-accent': '#0D9488', // Teal primary
        'light-success': '#16A34A',
        'light-warning': '#D97706',
        'light-danger': '#DC2626',

        // Dark mode — preserved from previous version
        'dark-bg': '#0f1416',
        'dark-panel': '#161d20',
        'dark-panel-raised': '#1c2528',
        'dark-border': '#2a3538',
        'dark-text': '#e7ece9',
        'dark-muted': '#8fa0a3',
        'dark-accent': '#e3a008',
        'dark-danger': '#c1443c',
        'dark-teal': '#2fa8a0',

        // Semantic aliases (resolved in use based on dark mode)
        bg: '#F8FAFC',
        panel: '#FFFFFF',
        'panel-raised': '#F8FAFC',
        border: '#CBD5E1',
        'border-light': '#E2E8F0',
        text: '#1E293B',
        muted: '#64748B',
        accent: '#0D9488',
        'accent-dim': '#D1FAE5',
        teal: '#0D9488',
        danger: '#DC2626',
        'danger-dim': '#FEE2E2',
        success: '#16A34A',
        'success-dim': '#DCFCE7',
        warning: '#D97706',
        'warning-dim': '#FEF3C7',
      },
      fontFamily: {
        display: ['Source Serif 4', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['Roboto Mono', 'IBM Plex Mono', 'SFMono-Regular', 'monospace'],
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
        'sm': '2px',
        'md': '4px',
        'lg': '6px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'drawer': '0 8px 16px rgba(0, 0, 0, 0.12)',
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