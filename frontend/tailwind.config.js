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
                        // Emergent.sh Theme Colors - Softer Tones
                        'emergent-green': '#10b981', // هادئ بدلاً من #00ff88
                        'emergent-green-dark': '#059669',
                        'emergent-green-light': '#34d399',
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
                                DEFAULT: '#10b981', // أخضر هادئ
                                foreground: '#ffffff'
                        },
                        secondary: {
                                DEFAULT: '#1f1f1f',
                                foreground: '#10b981'
                        },
                        muted: {
                                DEFAULT: '#262626',
                                foreground: '#a3a3a3'
                        },
                        accent: {
                                DEFAULT: '#10b981',
                                foreground: '#ffffff'
                        },
                        destructive: {
                                DEFAULT: '#ef4444',
                                foreground: '#ededed'
                        },
                        border: '#2a2a2a',
                        input: '#1f1f1f',
                        ring: '#10b981',
                        chart: {
                                '1': '#10b981',
                                '2': '#059669',
                                '3': '#34d399',
                                '4': '#6ee7b7',
                                '5': '#a7f3d0'
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
                                '0%, 100%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' },
                                '50%': { boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)' },
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                },
                boxShadow: {
                        'glow': '0 0 15px rgba(16, 185, 129, 0.2)',
                        'glow-lg': '0 0 25px rgba(16, 185, 129, 0.3)',
                        'glow-sm': '0 0 10px rgba(16, 185, 129, 0.15)',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
