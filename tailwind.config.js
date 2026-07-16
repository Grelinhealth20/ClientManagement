/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand system
        navy: {
          DEFAULT: "#0B1F3A",
          900: "#050E1C",
          800: "#0B1F3A",
          700: "#122A4D",
          600: "#1C3A63",
        },
        ink: "#0A0A0A", // dark black for labels/text
        copper: {
          DEFAULT: "#CF9455",
          600: "#C0803B",
          700: "#A96B29",
          400: "#DDAB74",
        },
        mist: "#F4F6FA",
        line: "#E4E8F0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      backgroundImage: {
        // Login: copper sheen washing down from the top edge of the panel.
        "panel-sheen":
          "radial-gradient(120% 100% at 50% 0%, rgba(207,148,85,0.09) 0%, rgba(255,255,255,0) 70%)",
        // Login: vignette that settles the outer edges of the backdrop.
        "backdrop-vignette":
          "radial-gradient(100% 80% at 50% 50%, transparent 55%, rgba(11,31,58,0.05) 100%)",
      },
      boxShadow: {
        elev: "0 1px 2px rgba(11,31,58,0.04), 0 12px 32px -12px rgba(11,31,58,0.14)",
        copper: "0 8px 24px -8px rgba(207,148,85,0.55)",
        crisp: "0 1px 0 rgba(11,31,58,0.04), 0 2px 8px rgba(11,31,58,0.06)",
        // Login: lifts the white panel off the light backdrop.
        panel: "0 2px 4px rgba(11,31,58,0.04), 0 28px 70px -22px rgba(11,31,58,0.30)",
        "panel-btn": "0 14px 30px -10px rgba(11,31,58,0.6)",
      },
      borderRadius: {
        xl2: "1.15rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        // Login: light sweep travelling along the panel's top accent bar.
        "accent-sweep": {
          "0%": { transform: "translateX(-60%)" },
          "100%": { transform: "translateX(260%)" },
        },
        // Login: slow vertical scanline crossing the backdrop.
        scanline: {
          "0%": { transform: "translateY(-10vh)", opacity: "0" },
          "12%, 88%": { opacity: "1" },
          "100%": { transform: "translateY(110vh)", opacity: "0" },
        },
        // Client nav: flowing navy↔copper gradient border. The gradient is laid
        // out at 200% width and its position is animated so the colours travel
        // continuously around the bar.
        "border-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        "accent-sweep": "accent-sweep 3.8s cubic-bezier(0.4,0,0.2,1) infinite",
        scanline: "scanline 9s linear infinite",
        "border-flow": "border-flow 4s linear infinite",
      },
    },
  },
  plugins: [],
};
