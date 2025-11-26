import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'selector',
  darkModeSelector: '.dark',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8fafc',
          subtle: '#eef2ff',
        },
      },
    },
  },
  plugins: [],
}

export default config
