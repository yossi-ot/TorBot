/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // TorBot brand — blue primary (the robot) + green accent (the "BOT" wordmark)
        primary: {
          50: '#EAF6FC',
          100: '#D0EBF8',
          200: '#A6D8F0',
          300: '#6FC0E6',
          400: '#3FA7DA',
          500: '#2E97D4',
          600: '#1F7FB8',
          700: '#1A6A9B',
          800: '#155680',
          900: '#114766',
        },
        accent: {
          50: '#ECF8EA',
          100: '#D6F0D1',
          200: '#AEE0A4',
          300: '#82CE73',
          400: '#5DBB4B',
          500: '#4CAF3E',
          600: '#3D9131',
          700: '#327727',
          800: '#285F20',
          900: '#1F4A19',
        },
      },
      fontFamily: {
        sans: ['Heebo', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2E97D4 0%, #4CAF3E 100%)',
      },
    },
  },
  plugins: [],
};
