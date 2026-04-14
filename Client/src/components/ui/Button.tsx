import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60',
          {
            'bg-gradient-to-r from-blue-600 to-purple-600 text-slate-50 hover:from-blue-700 hover:to-purple-700':
              variant === 'primary',
            'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600':
              variant === 'secondary',
            'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white':
              variant === 'ghost',
            'bg-red-600 text-slate-50 hover:bg-red-700': variant === 'danger',
            'border border-slate-600 bg-transparent text-slate-300 hover:border-slate-500 hover:bg-slate-800':
              variant === 'outline',
          },
          {
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-3 text-sm': size === 'md',
            'px-6 py-4 text-base': size === 'lg',
          },
        ),
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
