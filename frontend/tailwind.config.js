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
                        // Emergent.sh الألوان الدقيقة المستخرجة من الموقع الأصلي
                        'emergent-cyan': '#3CC3B6', // التركواز الأساسي
                        'emergent-cyan-dark': '#2FA89D',
                        'emergent-cyan-light': '#5FD4C9',
                        'emergent-black': '#121314', // الخلفية الرئيسية
                        'emergent-dark': '#2D2D2D', // Cards
                        'emergent-darker': '#1E1E1E',
                        'emergent-gray': '#323232',
                        'emergent-text': '#919597', // النص الثانوي
                        
                        background: '#121314',
                        foreground: '#F5F5F5',
                        card: {
                                DEFAULT: '#2D2D2D',
                                foreground: '#F5F5F5'
                        },
                        popover: {
                                DEFAULT: '#2D2D2D',
                                foreground: '#F5F5F5'
                        },
                        primary: {
                                DEFAULT: '#3CC3B6',
                                foreground: '#ffffff'
                        },
                        secondary: {
                                DEFAULT: '#1E1E1E',
                                foreground: '#919597'
                        },
                        muted: {
                                DEFAULT: '#323232',
                                foreground: '#919597'
                        },
                        accent: {
                                DEFAULT: '#3CC3B6',
                                foreground: '#ffffff'
                        },
                        destructive: {
                                DEFAULT: '#ef4444',
                                foreground: '#ffffff'
                        },
                        border: '#323232',
                        input: '#1E1E1E',
                        ring: '#3CC3B6',
                        chart: {
                                '1': '#3CC3B6',
                                '2': '#2FA89D',
                                '3': '#5FD4C9',
                                '4': '#8BE0D8',
                                '5': '#B7ECE7'
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
                                '0%, 100%': { boxShadow: '0 0 15px rgba(60, 195, 182, 0.3)' },
                                '50%': { boxShadow: '0 0 25px rgba(60, 195, 182, 0.5)' },
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                },
                boxShadow: {
                        'glow': '0 0 15px rgba(60, 195, 182, 0.3)',
                        'glow-lg': '0 0 25px rgba(60, 195, 182, 0.4)',
                        'glow-sm': '0 0 10px rgba(60, 195, 182, 0.2)',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
