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
                        // Emergent.sh Theme Colors - مستخرجة من الموقع الأصلي
                        'emergent-green': '#00C846',
                        'emergent-green-dark': '#00A038',
                        'emergent-green-light': '#00E050',
                        'emergent-black': '#1E1E1E',
                        'emergent-dark': '#2D2D2D',
                        'emergent-darker': '#282828',
                        'emergent-gray': '#323232',
                        
                        background: '#1E1E1E',
                        foreground: '#F0F0F0',
                        card: {
                                DEFAULT: '#2D2D2D',
                                foreground: '#F0F0F0'
                        },
                        popover: {
                                DEFAULT: '#2D2D2D',
                                foreground: '#F0F0F0'
                        },
                        primary: {
                                DEFAULT: '#00C846',
                                foreground: '#ffffff'
                        },
                        secondary: {
                                DEFAULT: '#282828',
                                foreground: '#C8C8C8'
                        },
                        muted: {
                                DEFAULT: '#323232',
                                foreground: '#B4B4B4'
                        },
                        accent: {
                                DEFAULT: '#00C846',
                                foreground: '#ffffff'
                        },
                        destructive: {
                                DEFAULT: '#ef4444',
                                foreground: '#ffffff'
                        },
                        border: '#323232',
                        input: '#282828',
                        ring: '#00C846',
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
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'glow-pulse': {
                                '0%, 100%': { boxShadow: '0 0 15px rgba(0, 200, 70, 0.2)' },
                                '50%': { boxShadow: '0 0 25px rgba(0, 200, 70, 0.4)' },
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                },
                boxShadow: {
                        'glow': '0 0 15px rgba(0, 200, 70, 0.2)',
                        'glow-lg': '0 0 25px rgba(0, 200, 70, 0.3)',
                        'glow-sm': '0 0 10px rgba(0, 200, 70, 0.15)',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
