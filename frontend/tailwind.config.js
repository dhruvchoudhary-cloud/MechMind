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
        natgeo: {
          bg: '#050505',
          bgSecondary: '#0B0B0B',
          panel: '#111111',
          panelElevated: '#171717',
          border: '#303030',
          borderLight: '#444444',
          yellow: '#FFD629',
          yellowMuted: 'rgba(255, 214, 41, 0.15)',
          text: '#F4F4F4',
          textSecondary: '#A3A3A3',
          textMuted: '#6E6E6E',
          critical: '#FF554A',
          warning: '#F5B942',
          healthy: '#72C99A',
        },
        industrial: {
          bg: '#050505',
          surface: '#111111',
          surfaceHover: '#171717',
          border: '#303030',
          muted: '#6E6E6E',
          healthy: '#72C99A',
          warning: '#F5B942',
          critical: '#FF554A',
          accent: '#FFD629'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
