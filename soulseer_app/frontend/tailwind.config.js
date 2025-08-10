/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'alex-brush': ['"Alex Brush"', 'cursive'],
        'playfair': ['"Playfair Display"', 'serif'],
      },
      colors: {
        'soul-pink': '#F72585',
        'soul-pink-light': '#F957A0',
        'soul-purple': '#480CA8',
        'soul-purple-dark': '#3A0A8A',
        'soul-gold': '#FFD700',
        'soul-black': '#121212',
        'soul-gray': {
          100: '#E0E0E0',
          200: '#C0C0C0',
          300: '#A0A0A0',
          400: '#808080',
          500: '#606060',
          600: '#404040',
          700: '#303030',
          800: '#202020',
          900: '#1A1A1A',
        },
      },
      textShadow: {
        'glow-pink': '0 0 8px #F72585',
        'glow-gold': '0 0 8px #FFD700',
      },
      animation: {
        gradientShift: 'gradientShift 15s ease infinite',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-textshadow'),
  ],
};