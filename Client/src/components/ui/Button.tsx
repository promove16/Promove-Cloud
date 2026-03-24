import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60',
          {
            'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700':
              variant === 'primary',
            'border border-slate-700 bg-slate-900 text-white hover:border-slate-600':
              variant === 'secondary',
            'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white':
              variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          },
        ),
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
