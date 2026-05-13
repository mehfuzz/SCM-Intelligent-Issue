import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        airtel: {
          red: "#E40000",
          redDark: "#B80000",
          redLight: "#FFE5E5",
          black: "#1a1a1a",
          gray: "#6B6B6B",
          surface: "#FAFAFA",
          border: "#EAEAEA"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)"
      }
    }
  },
  plugins: []
};

export default config;
