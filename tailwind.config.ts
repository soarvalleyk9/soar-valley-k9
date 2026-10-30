import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        heading: "#2F5D7B",
        ink: "#1F2D38",
        primary: "#3D79A0",
        "primary-hover": "#2F5D7B",
        secondary: "#4E7449",
        "secondary-hover": "#436040",
        moss: "#587E54",
        tint: "#EEF6FA",
        "tint-green": "#EFF5EC",
        navy: "#1E3A52",
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
};

export default config;
