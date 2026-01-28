import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FBFCFE',
        border: '#E6E9EF',
        muted: '#6B7280',
        heading: '#111827',
        primary: '#269B62',
        // Dashboard metrics colors
        metrics: {
          blue: {
            light: '#EFF6FF',
            border: '#BFDBFE',
            text: '#1E40AF',
            dot: '#3B82F6',
          },
          purple: {
            light: '#FAF5FF',
            border: '#E9D5FF',
            text: '#6B21A8',
            dot: '#A855F7',
          },
          emerald: {
            light: '#F0FDF4',
            border: '#BBEDD5',
            text: '#047857',
            dot: '#10B981',
          },
          orange: {
            light: '#FFF7ED',
            border: '#FED7AA',
            text: '#92400E',
            dot: '#F97316',
          },
          yellow: {
            light: '#FEFCE8',
            border: '#FEF08A',
            text: '#854D0E',
            dot: '#EAB308',
          },
        },
      },
      borderRadius: {
        xl: '12px',
      },
      boxShadow: {
        subtle: '0 1px 0 rgba(17,24,39,0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
