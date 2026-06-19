import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#11151A",
        paper: "#F7F5F0",
        accent: "#2E5339", // verde oscuro, "patrimonio" / confianza
      },
    },
  },
  plugins: [],
};

export default config;
