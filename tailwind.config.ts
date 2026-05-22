import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#12100f",
        carbon: "#1b1816",
        graphite: "#26211d",
        ember: "#b67a38",
        amberglow: "#d29a52",
        smoke: "#e7d9c8",
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)"
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)"
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)"
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)"
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)"
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)"
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)"
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)"
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        diffusion: "0 30px 90px -40px rgba(0, 0, 0, 0.75)",
        panel: "0 28px 60px -40px rgba(0, 0, 0, 0.72)"
      },
      backgroundImage: {
        "warm-radial":
          "radial-gradient(circle at top, rgba(210, 154, 82, 0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(112, 65, 29, 0.18), transparent 30%)"
      },
      animation: {
        grain: "grain 8s steps(10) infinite",
        steam: "steam 5.8s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite"
      },
      keyframes: {
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-2%, -4%)" },
          "30%": { transform: "translate(3%, -1%)" },
          "50%": { transform: "translate(-2%, 3%)" },
          "70%": { transform: "translate(4%, 1%)" },
          "90%": { transform: "translate(-1%, -2%)" }
        },
        steam: {
          "0%, 100%": { opacity: "0.1", transform: "translate3d(0, 18px, 0) scale(0.95)" },
          "50%": { opacity: "0.38", transform: "translate3d(0, -12px, 0) scale(1.03)" }
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" }
        }
      }
    }
  },
  plugins: []
};

export default config;
