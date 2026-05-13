/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0F0F14',
        card: '#1A1A22',
        glass: 'rgba(255,255,255,0.05)',
        primary: '#D61A4E',
        'primary-dark': '#5A0A1E',
        'primary-mid': '#8A0F2A',
        'primary-light': '#FF3D6E',
        'text-primary': '#FFFFFF',
        'text-secondary': '#B3B3B8',
        'text-muted': '#6E6E73',
        success: '#30D158',
        warning: '#FF9F0A',
        error: '#FF453A',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
