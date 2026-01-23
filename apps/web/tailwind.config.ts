import type { Config } from 'tailwindcss';

const config: Config = {
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
