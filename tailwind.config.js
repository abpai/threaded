/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode palette - 3 distinct surface levels + cyan accent
        dark: {
          base: '#09090b', // zinc-950 - deepest background
          surface: '#18181b', // zinc-900 - cards, panels
          elevated: '#27272a', // zinc-800 - inputs, interactive
          border: '#3f3f46', // zinc-700 - visible borders
        },
        accent: {
          DEFAULT: '#22d3ee', // cyan-400 - primary accent
          muted: '#0891b2', // cyan-600 - hover, secondary
          glow: 'rgba(34, 211, 238, 0.15)', // subtle highlight bg
        },
      },
    },
  },
  plugins: [],
}
