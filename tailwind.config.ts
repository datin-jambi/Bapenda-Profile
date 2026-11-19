import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#1A3A6B",
          foreground: "#ffffff",
          50: "#e8edf5",
          100: "#c5d0e6",
          200: "#9fb1d6",
          300: "#7892c5",
          400: "#587bb9",
          500: "#3864ad",
          600: "#2e56a0",
          700: "#1A3A6B",
          800: "#162f5a",
          900: "#0e1e3b",
        },
        // Palet logo SELOKO: navy wordmark, biru ribbon, cyan aksen.
        seloko: {
          navy: "#03317A",
          blue: "#0A5FD0",
          cyan: "#0EB4F5",
          ink: "#0B1F4A",
          mist: "#EEF6FD",
          success: "#0F9F6E",
          danger: "#E0456B",
          warn: "#F59E0B",
        },
        secondary: {
          DEFAULT: "#E8A020",
          foreground: "#ffffff",
          50: "#fdf4e3",
          100: "#fae3b9",
          200: "#f6d08c",
          300: "#f2bc5e",
          400: "#efad3c",
          500: "#E8A020",
          600: "#d48f18",
          700: "#bb7a0e",
          800: "#a36608",
          900: "#7d4b02",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scan: {
          "0%, 100%": { top: "0" },
          "50%": { top: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "count-up": "count-up 0.5s ease-out",
        scan: "scan 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
