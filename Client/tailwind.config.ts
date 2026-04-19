import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import colors from 'tailwindcss/colors';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Remap cyan → blue to match the Figma blue-to-purple brand palette
        cyan: colors.blue,
      },
    },
  },
  plugins: [forms],
} satisfies Config;
