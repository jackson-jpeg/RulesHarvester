/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0c10',
        surface: '#161b22',
        'surface-elevated': '#21262d',
        border: '#30363d',
        text: {
          primary: '#e6edf3',
          secondary: '#a1a9b2', // Improved contrast (was #8b949e)
          muted: '#848d97', // Improved contrast (was #6e7681)
        },
        accent: {
          primary: '#f59e0b', // Amber for focus rings
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
