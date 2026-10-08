/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.08)',
        lift: '0 4px 6px -2px rgba(15, 23, 42, 0.06), 0 14px 28px -8px rgba(15, 23, 42, 0.18)',
        glow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
      },
      keyframes: {
        // NFR-13: highlight a card that was just moved (locally or by a teammate)
        flash: {
          '0%': { boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.9), 0 10px 30px -6px rgba(99, 102, 241, 0.45)' },
          '100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0), 0 1px 2px rgba(15, 23, 42, 0.04)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        flash: 'flash 1.4s ease-out',
        shake: 'shake 0.45s ease-in-out',
        'fade-up': 'fade-up 0.35s ease-out backwards',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        ping: 'ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
