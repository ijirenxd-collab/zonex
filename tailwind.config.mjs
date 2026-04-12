/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--color-primary, #6d28d9)',
                    dark: 'var(--color-primary-dark, #5b21b6)',
                    light: 'var(--color-primary-light, #ede9fe)',
                    text: 'var(--color-primary-text, #ffffff)'
                },
                accent: {
                    DEFAULT: 'var(--color-accent, #ffb16e)',
                },
                secondary: {
                    DEFAULT: 'var(--color-accent, #ffb16e)',
                    light: 'var(--color-secondary-light, #f9f9f9)'
                },
                heading: {
                    DEFAULT: "var(--color-heading, #111827)",
                    light: "var(--color-heading-light, #374151)"
                },
                body: "#555555",
                white: {
                    DEFAULT: "#FFFFFF",
                    light: "#f9f9f9",
                    lighter: "#fafafa",
                    "deep": "#EDEBF5"
                },
                gray: {
                    'light': '#f7f7f7'
                },
                blue: {
                    dark: "#0f0054"
                },
                violet: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                    950: '#2e1065',
                },
            },
            spacing: {
                30: '30px',
                15: '60px',
                50: '50px'
            },
            borderWidth: {
                1: '1px',
            },
            keyframes: {
                'waves': {
                    '0%': { transform: 'scale(0)' },
                    '100%': { opacity: '0', transform: 'scale(1.0)' },
                },
                'fadeInDown': {
                    'from': { opacity: '0', transform: 'translate3d(0, -100%, 0)' },
                    'to': { opacity: '1', transform: 'none' }
                }
            },
            animation: {
                'spinner': 'waves 1.0s infinite ease-in-out',
                'fadeInDown': 'fadeInDown .7s ease-in-out 0s 1 normal none running'
            }
        },
        fontSize: {
            base: ['15px'],
            normal: "16px",
            sm: ['0.875rem'],
            lg: ['1.125rem'],
            xl: ['1.25rem'],
            '2xl': ['1.5rem'],
            '3xl': ['1.875rem'],
            '4xl': ['2.25rem'],
            '6xl': ['3.75rem', { lineHeight: '1.2' }],
        },
        fontFamily: {
            base: ['var(--font-base)', 'Poppins', 'sans-serif'],
            heading: ['var(--font-heading)', 'Poppins', 'sans-serif'],
        },
        container: {
            center: true,
            padding: {
                DEFAULT: "15px"
            },
        },
        screens: {
            xs: '480px',
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1200px',
        },
    },
    plugins: [],
}
