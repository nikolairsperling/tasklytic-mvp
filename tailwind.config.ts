import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        slate: "#1e293b",
        sand: "#f8fafc",
        brand: "#12324a",
        primary: "#0f172a",
        accent: "#d6e8f5",
        success: "#0f766e"
      },
      boxShadow: {
        panel: "0 10px 40px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
