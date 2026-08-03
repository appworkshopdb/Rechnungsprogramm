/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        xs: '400px',
      },
      colors: {
        // Farbschema "Marineblau & Smaragd".
        // Die ursprünglichen Namen (tanne/rinde/moos/papier/rost) bleiben
        // erhalten, damit nicht jede Komponente umgeschrieben werden muss —
        // nur ihre Werte wurden auf das neue Schema umgestellt.
        // tanne = Marineblau-Töne (Menü, Primärflächen, Haupttext)
        tanne: {
          950: '#141a29',
          900: '#1c2438',
          800: '#26314a',
          700: '#33415f',
          600: '#3d5280',
          500: '#5a6b90',
        },
        // rinde = neutrale Blaugrau-Töne (früher Braun; für dezente Badges/Akzente)
        rinde: {
          700: '#4a5568',
          500: '#6b7280',
          300: '#c3cad6',
        },
        // papier = sehr heller, fast weißer Blaugrau-Ton.
        // Dient sowohl als heller Text auf dunklem Menü/Buttons als auch
        // als heller Seiten-/Modalhintergrund.
        papier: '#f4f5f8',
        // moos = Smaragdgrün (Akzent, Status "bezahlt", positive Aktionen)
        moos: '#1d9e75',
        // rost = kräftiges Rot (Warnungen, Löschen, "storniert/überfällig")
        rost: '#d64545',
      },
      fontFamily: {
        // Alles in Inter — sachlich, klar, gut lesbar.
        display: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
