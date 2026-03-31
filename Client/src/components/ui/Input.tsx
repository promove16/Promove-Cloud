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
          'w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-0',
        ),
        className,
      )}
      style={{
        ...(type === 'date' || type === 'time' || type === 'datetime-local'
          ? { colorScheme: 'dark' }
          : {}),
        ...style,
      }}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
