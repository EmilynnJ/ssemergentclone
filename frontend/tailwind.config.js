/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'alex-brush': ['"Alex Brush"', 'cursive'],
        'playfair': ['"Playfair Display"', 'serif'],
      },
      colors: {
        'soul-pink': '#F72585',
        'soul-pink-light': '#F957A0', // Lighter shade for hover/accents
        'soul-purple': '#480CA8',
        'soul-purple-dark': '#3A0A8A', // Darker shade
        'soul-gold': '#FFD700', // Gold for accents
        'soul-black': '#121212', // Main dark background
        'soul-gray': { // Shades of gray for text and secondary elements
          100: '#E0E0E0', // Lightest gray for text
          200: '#C0C0C0',
          300: '#A0A0A0',
          400: '#808080', // Medium gray for borders/dividers
          500: '#606060',
          600: '#404040', // Darker gray for card backgrounds
          700: '#303030',
          800: '#202020', // Very dark gray
          900: '#1A1A1A',
        },
      },
      // Example for text-shadow, though direct CSS might be easier for complex glows
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
        }
      }
    },
  },
  plugins: [
    require('tailwindcss-textshadow') // If using the text-shadow plugin
  ],
};