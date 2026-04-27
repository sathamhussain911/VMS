import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // FFC Brand Palette
        primary: {
          50:  '#f2fae8',
          100: '#e8f7d8',
          200: '#c7e8a8',
          300: '#a0d46f',
          400: '#7abf4a',
          500: '#5ba829',
          600: '#4d8c20',
          700: '#3d7a18',
          800: '#2a6b08',
          900: '#1b4a00',
        },
        amber: {
          DEFAULT: '#f5a02a',
          light: '#fef3dc',
        },
        danger: {
          DEFAULT: '#e53e3e',
          light: '#fff0f0',
        },
        surface: '#edf7e0',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,.1)',
        modal: '0 10px 30px rgba(0,0,0,.14)',
      },
    },
  },
  plugins: [],
}

export default config
