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
                        // Emergent.sh Theme Colors - أكثر وضوحاً
                        'emergent-green': '#22c55e', // أفتح وأوضح
                        'emergent-green-dark': '#16a34a',
                        'emergent-green-light': '#4ade80',
                        'emergent-black': '#0a0a0a',
                        'emergent-dark': '#1a1a1a',
                        'emergent-gray': '#3a3a3a', // أفتح
                        
                        background: '#0a0a0a',
                        foreground: '#f5f5f5', // أبيض أكثر
                        card: {
                                DEFAULT: '#1a1a1a',
                                foreground: '#f5f5f5'
                        },
                        popover: {
                                DEFAULT: '#1a1a1a',
                                foreground: '#f5f5f5'
                        },
                        primary: {
                                DEFAULT: '#22c55e', // أخضر أوضح
                                foreground: '#ffffff'
                        },
                        secondary: {
                                DEFAULT: '#2a2a2a', // أفتح
                                foreground: '#22c55e'
                        },
                        muted: {
                                DEFAULT: '#3a3a3a', // أفتح
                                foreground: '#d1d1d1' // أوضح
                        },
                        accent: {
                                DEFAULT: '#22c55e',
                                foreground: '#ffffff'
                        },
                        destructive: {
                                DEFAULT: '#ef4444',
                                foreground: '#ffffff'
                        },
                        border: '#3a3a3a', // أفتح وأوضح
                        input: '#2a2a2a', // أفتح
                        ring: '#22c55e',
                        chart: {
                                '1': '#00C846',
                                '2': '#00A038',
                                '3': '#00E050',
                                '4': '#66E687',
                                '5': '#99F0AB'
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
