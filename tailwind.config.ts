import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Warm, light palette — "parchment meets modern"
        canvas: {
          DEFAULT: '#faf8f5',
          warm: '#f5f0ea',
          deep: '#ede6dc',
          muted: '#e2d9cd',
        },
        ink: {
          DEFAULT: '#1a1715',
          soft: '#3d3833',
          muted: '#7a7168',
          ghost: '#b5aa9e',
          faint: '#d4ccc2',
        },
        // Accent: single warm accent color for interactive elements
        ember: {
          DEFAULT: '#c4633a',
          light: '#d98a6a',
          dark: '#9e4e2d',
          glow: 'rgba(196, 99, 58, 0.12)',
        },
        // Status colors (muted, warm)
        state: {
          listen: '#5a8f7a',
          think: '#c49a3a',
          speak: '#7a6aaf',
          idle: '#b5aa9e',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.6s ease both',
        'scale-in': 'scaleIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'float': 'float 5s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
