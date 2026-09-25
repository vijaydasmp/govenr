import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        slate: {
          // brand slate — distinct from Tailwind's built-in slate scale
          brand: '#1e3a5f',
          'brand-dim': 'rgba(30,58,95,0.07)',
        },
        gold: {
          DEFAULT: '#a4762a',
          dim: 'rgba(164,118,42,0.10)',
        },
        l1: {
          DEFAULT: '#0b5e8a',
          dim: 'rgba(11,94,138,0.08)',
        },
        doc: {
          DEFAULT: '#8a5a0b',
          dim: 'rgba(138,90,11,0.09)',
        },
        rail: {
          DEFAULT: '#047857',
          dim: 'rgba(4,120,87,0.09)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
