/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./offscreen.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "#0F172A", // Slate 900
        surface: "#1E293B", // Slate 800
        elevated: "#334155", // Slate 700
        subtle: "#475569", // Slate 600
        accent: "#2563EB", // Blue 600
        'accent-hover': "#1D4ED8", // Blue 700
        recording: "#EF4444", // Red 500
        paused: "#F59E0B", // Amber 500
        success: "#10B981" // Emerald 500
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      }
    },
  },
  plugins: [],
}
