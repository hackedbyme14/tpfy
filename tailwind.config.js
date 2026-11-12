// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#121826",
          card: "#1B2333",
          raised: "#242D42",
        },
        accent: {
          DEFAULT: "#E8A33D",
          soft: "#F0B968",
        },
      },
      boxShadow: {
        player: "0 -8px 30px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};
