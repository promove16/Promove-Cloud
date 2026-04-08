import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, style, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={twMerge(
        clsx(
          'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-0 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500',
        ),
        className,
      )}
      style={style}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
