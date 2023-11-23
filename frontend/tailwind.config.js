/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      width: {
        '56-percent': '56%',
      },
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      'skin-color': '#E0643C1A',
      maincolor: 'rgba(224, 100, 60, 1)',
    },
    fontFamily: {
      murecho: ['Murecho', 'sans-serif'],
    },
    borderWidth: {
      DEFAULT: '0.5px',
      0.5: '0.5px',
    },
  },
  plugins: [],
}
