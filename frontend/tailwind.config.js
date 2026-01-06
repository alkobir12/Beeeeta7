/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        // Emergent.sh Theme Colors
                        'emergent-green': '#00ff88',
                        'emergent-green-dark': '#00cc6e',
                        'emergent-green-light': '#1affa3',
                        'emergent-black': '#0a0a0a',
                        'emergent-dark': '#1a1a1a',
                        'emergent-gray': '#2a2a2a',
                        
                        background: '#0a0a0a',
                        foreground: '#ededed',
                        card: {
                                DEFAULT: '#1a1a1a',
                                foreground: '#ededed'
                        },
                        popover: {
                                DEFAULT: '#1a1a1a',
                                foreground: '#ededed'
                        },
                        primary: {
                                DEFAULT: '#00ff88',
                                foreground: '#0a0a0a'
                        },
                        secondary: {
                                DEFAULT: '#1f1f1f',
                                foreground: '#00ff88'
                        },
                        muted: {
                                DEFAULT: '#262626',
                                foreground: '#a3a3a3'
                        },
                        accent: {
                                DEFAULT: '#00ff88',
                                foreground: '#0a0a0a'
                        },
                        destructive: {
                                DEFAULT: '#ff3366',
                                foreground: '#ededed'
                        },
                        border: '#2a2a2a',
                        input: '#1f1f1f',
                        ring: '#00ff88',
                        chart: {
                                '1': '#00ff88',
                                '2': '#00cc6e',
                                '3': '#1affa3',
                                '4': '#80ffcc',
                                '5': '#4dffb8'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: {
                                        height: '0'
                                },
                                to: {
                                        height: 'var(--radix-accordion-content-height)'
                                }
                        },
                        'accordion-up': {
                                from: {
                                        height: 'var(--radix-accordion-content-height)'
                                },
                                to: {
                                        height: '0'
                                }
                        },
                        'glow-pulse': {
                                '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)' },
                                '50%': { boxShadow: '0 0 40px rgba(0, 255, 136, 0.6)' },
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                },
                boxShadow: {
                        'glow': '0 0 20px rgba(0, 255, 136, 0.3)',
                        'glow-lg': '0 0 40px rgba(0, 255, 136, 0.4)',
                        'glow-sm': '0 0 10px rgba(0, 255, 136, 0.2)',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
