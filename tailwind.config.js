/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Farbschema angelehnt an Nadelwald/Rinde/Papier statt generischem Blau
        tanne: {
          950: '#0d1a12',
          900: '#132417',
          800: '#1c3320',
          700: '#28472c',
          600: '#385f3d',
          500: '#4c7a52',
        },
        rinde: {
          700: '#5a4632',
          500: '#8a6f4f',
          300: '#c7ab7f',
        },
        papier: '#f6f3ec',
        moos: '#7c9a72',
        rost: '#b5502f',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
