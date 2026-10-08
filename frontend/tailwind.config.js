/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        zoom: {
          bgDark: '#1a1d21',
          sidebarDark: '#121417',
          cardDark: '#24272c',
          blue: '#0e78f9',
          blueHover: '#0b61ca',
          orange: '#ff742e',
          navActive: '#2d3238',
          textMuted: '#9ca3af',
        },
      },
    },
  },
  plugins: [],
};