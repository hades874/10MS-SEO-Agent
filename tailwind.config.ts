import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E63946",
          dark: "#1d3557",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
