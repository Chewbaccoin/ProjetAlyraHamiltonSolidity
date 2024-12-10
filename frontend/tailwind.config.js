// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // vous pouvez personnaliser les couleurs ici
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('daisyui')
  ],
  darkMode: 'class',
}