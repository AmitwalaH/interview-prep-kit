/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#141820",
        surface: "#1C212B",
        "surface-raised": "#242A36",
        border: "#2E3542",
        amber: {
          DEFAULT: "#E8A33D",
          dim: "#B8842F",
        },
        sage: {
          DEFAULT: "#6FBF8B",
          dim: "#4E8A63",
        },
        coral: {
          DEFAULT: "#C75450",
          dim: "#9B403D",
        },
        ink: {
          DEFAULT: "#EDEFF3",
          muted: "#8A93A3",
          faint: "#5C6473",
        },
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
